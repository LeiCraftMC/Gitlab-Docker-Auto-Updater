import { YAML } from "bun";
import { Logger } from "./logger";

export class Utils {

    static async getCurrentGitlabVersionFromContainer(dockerContainerName: string): Promise<string> {
        const execResult = await Bun.spawn({
            cmd: [
                "docker", "exec", "-t", dockerContainerName,
                "cat", "/opt/gitlab/version-manifest.txt", "|", "head", "-n", "1", "|", "awk", "'{print $2}'"
            ],
            stderr: "pipe",
            stdout: "pipe"
        });
        const stdout = await execResult.stdout.text();
        const stderr = await execResult.stderr.text();
        if (execResult.exitCode !== 0) {
            Logger.error(`Error getting current Gitlab version: ${stderr}`);
            throw new Error(`Failed to get current Gitlab version from container ${dockerContainerName}`);
        }

        const versionRegex = /^(\d+\.\d+\.\d+)$/;
        const match = stdout.trim().match(versionRegex);
        if (!match) {
            Logger.error(`Unexpected version format: ${stdout.trim()}`);
            throw new Error(`Unexpected version format received from container ${dockerContainerName}`);
        }
        return match[1] as string;
    }

    static async getLatestGitlabVersion(): Promise<string> {
        const response = await fetch("https://gitlab.com/api/v4/projects/13083/releases");

        if (!response.ok) {
            Logger.error(`Failed to fetch latest Gitlab version: ${response.statusText}`);
            throw new Error("Failed to fetch latest Gitlab version");
        }

        const latestReleases = await response.json() as Array<{ tag_name: string }>;
        const latestRelease = latestReleases[0];
        if (!latestRelease || !latestRelease.tag_name) {
            Logger.error("No releases found in Gitlab API response");
            throw new Error("No releases found in Gitlab API response");
        }

        const versionRegex = /^v(\d+\.\d+\.\d+)$/;
        const match = latestRelease.tag_name.trim().match(versionRegex)
        if (!match) {
            Logger.error(`Unexpected latest version format: ${latestRelease.tag_name}`);
            throw new Error("Unexpected latest Gitlab version format received");
        }
        return match[1] as string;
    }

    static async replaceGitlabVersionInComposeFile(filePath: string, oldVersion: string, newVersion: string): Promise<void> {
        const file = await Bun.file(filePath);

        if (!await file.exists()) {
            throw new Error(`Cannot find a valid docker-compose file at path: ${filePath}`);
        }

        const fileContent = await file.text();

        if (!fileContent.includes(`image: 'gitlab/gitlab-ce:${oldVersion}-ce.0'`)) {
            throw new Error(`The specified old version ${oldVersion} was not found in the docker-compose file.`);
        }

        const oldLine = `image: 'gitlab/gitlab-ce:${oldVersion}-ce.0'`;
        const newLine = `image: 'gitlab/gitlab-ce:${newVersion}-ce.0'`;

        const updated = fileContent.replace(oldLine, newLine);

        Logger.info(`Updated gitlab version in compose file from ${oldVersion} to ${newVersion}`);

        await Bun.write(filePath, updated);
    }

}
