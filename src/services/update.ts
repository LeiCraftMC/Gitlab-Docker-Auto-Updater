import { Delay } from "@cleverjs/utils";
import { Utils } from "../utils";
import { Logger } from "../utils/logger";

export class UpdateService {

    constructor(
        protected readonly dockerContainerName: string,
        protected readonly composeFilePath: string,
    ) {}

    protected async reDeployGitlab(): Promise<void> {

        Logger.info("Re-deploying Gitlab Docker container...");

        const downProcess = Bun.spawn({
            cmd: ["docker", "compose", "-f", this.composeFilePath, "down"],
            stdout: "pipe",
            stderr: "pipe"
        });

        const downProcessexitCode = await downProcess.exited;

        const downStdout = await downProcess.stdout.text();
        const downStderr = await downProcess.stderr.text();

        if (downProcessexitCode !== 0) {
            throw new Error(`Failed to bring down Gitlab container, stderr: ${downStderr}, stdout: ${downStdout}`);
        }

        Logger.info("Gitlab container brought down successfully.");

        const upProcess = Bun.spawn({
            cmd: ["docker", "compose", "-f", this.composeFilePath, "up", "-d"],
            stdout: "pipe",
            stderr: "pipe"
        });

        const upProcessexitCode = await upProcess.exited;

        const upStdout = await upProcess.stdout.text();
        const upStderr = await upProcess.stderr.text();

        if (upProcessexitCode !== 0) {
            throw new Error(`Failed to bring up Gitlab container, stderr: ${upStderr}, stdout: ${upStdout}`);
        }

        Logger.info("Gitlab container brought up successfully.");
    }

    async checkUpdateCanBePerformed(currentVersion: string) {
        Logger.info(`Checking if update can be performed...`);

        const version = Utils.getNextSafeGitlabUpgrade(
            await Utils.getLatestSupportedGitlabVersions(),
            currentVersion
        );

        if (!version) {
            Logger.warn(`No safe upgrade path found from version ${currentVersion}. Update cannot be performed.`);
            return {
                status: "NO_SAFE_UPGRADE_PATH",
                targetVersion: null
            } as const;
        }

        if (version === currentVersion) {
            Logger.info(`Current version ${currentVersion} is already the latest supported version. No update needed.`);
            return {
                status: "ALREADY_LATEST_VERSION",
                targetVersion: null
            } as const;
        }

        return {
            status: "UPDATE_POSSIBLE",
            targetVersion: version
        } as const;
    }

    async performUpdate(currentVersion: string, targetVersion: string): Promise<void> {

        Logger.info(`Performing update from version ${currentVersion} to ${targetVersion}...`);

        await Utils.pullGitlabDockerImage(targetVersion);

        await Utils.replaceGitlabVersionInComposeFile(
            this.composeFilePath,
            currentVersion,
            targetVersion
        );

        await this.reDeployGitlab();

        for (let attempt = 1; attempt <= 10; attempt++) {
            Logger.info(`Checking Gitlab health (Attempt ${attempt}/10)...`);
            const isHealthy = await Utils.checkGitlabHealth(this.dockerContainerName);
            if (isHealthy) {
                Logger.info("Gitlab is healthy after update.");
                return;
            }
            Logger.warn("Gitlab is not healthy yet. Waiting 30 seconds before retrying...");
            await Delay.wait(30_000);
        }
        throw new Error("Gitlab did not become healthy after update within the expected time.");

    }


}
