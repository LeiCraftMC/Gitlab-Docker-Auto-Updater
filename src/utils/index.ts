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

    /**
     * Determines the next safe GitLab upgrade target.
     * Based on tests: returns the latest version if the current version is 
     * at or above the second-to-last supported version.
     * @param {string[]} supportedVersions - Array of versions (expected descending order)
     * @param {string} currentVersion - The version currently installed
     * @returns {string|null}
     */
    static getNextSafeGitlabUpgrade(supportedVersions: string[], currentVersion: string): string | null {
        if (!supportedVersions || supportedVersions.length < 2) {
        return supportedVersions?.[0] === currentVersion ? currentVersion : null;
        }

        // The test shows the list is reversed, so index 0 is the latest target.
        const latest = supportedVersions[0] as string;
        const penultimate = supportedVersions[1] as string;

        const comparison = this.compareVersions(currentVersion, latest);

        // 1. If we are already on the latest version
        if (comparison === 0) {
            return latest;
        }

        // 2. If we are somehow ahead of the latest supported version
        if (comparison > 0) {
            return null;
        }

        // 3. If we are at or above the penultimate version, we can jump to latest
        if (this.compareVersions(currentVersion, penultimate) >= 0) {
            return latest;
        }

        // 4. Otherwise, the gap is too large for a "one-step" upgrade
        return null;
    }

    /**
     * Internal helper to compare semver strings (X.Y.Z)
     * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
     */
    protected static compareVersions(v1: string, v2: string): number {
        const a = v1.split('.').map(Number);
        const b = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const numA = a[i] || 0;
            const numB = b[i] || 0;
            if (numA > numB) return 1;
            if (numA < numB) return -1;
        }
        return 0;
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
