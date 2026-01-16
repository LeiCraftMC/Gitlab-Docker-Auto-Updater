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
            throw new Error(`Failed to get current Gitlab version from container ${dockerContainerName}, stderr: ${stderr}`);
        }

        const versionRegex = /^(\d+\.\d+\.\d+)$/;
        const match = stdout.trim().match(versionRegex);
        if (!match) {
            throw new Error(`Unexpected version format received from container ${dockerContainerName}, stdout: ${stdout.trim()}`);
        }
        return match[1] as string;
    }

    static async getLatestSupportedGitlabVersions(): Promise<string[]> {
        const response = await fetch("https://gitlab-com.gitlab.io/support/toolbox/upgrade-path/path.json");

        if (!response.ok) {
            throw new Error(`Failed to fetch latest Gitlab version, status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { supported: string[], all: string[] };

        if (!data.supported) {
            throw new Error("Invalid data format received from Gitlab upgrade path API");
        }
        // ensure newest versions are first
        return data.supported.reverse();
    }

    static async getNextSafeGitlabUpgrade(
        latestVersions: string[],
        currentVersion: string
    ): Promise<string | null> {

        const parse = (v: string) => v.split(".").map(n => Number(n));
        const [cMajor, cMinor, cPatch] = parse(currentVersion);

        const sorted = latestVersions
            .map(v => ({ v, p: parse(v) }))
            .filter(({ p }) => p.length >= 3)
            .sort((a, b) => {
                for (let i = 0; i < 3; i++) {
                    if (a.p[i] !== b.p[i]) return (b.p[i] as number) - (a.p[i] as number);
                }
                return 0;
            });

        for (const { v, p: [lMajor, lMinor, lPatch] } of sorted) {

            // Major upgrades are never automatic
            if (lMajor !== cMajor) continue;

            // Same minor → patch upgrade
            if (lMinor === cMinor && (lPatch as number) > (cPatch as number)) {
                return v;
            }

            // Exactly one minor jump → safe
            if (lMinor === (cMinor as number) + 1) {
                return v;
            }
        }

        return null;
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
