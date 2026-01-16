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
     * 
     * @param supportedVersions List of currently supported versions. Newest first
     * @param currentVersion The Current Version
     * @returns Next Version you can safly upgrade to or null. If you already on the newest version it will just echo it
     */
    static getNextSafeGitlabUpgrade(
        supportedVersions: string[],
        currentVersion: string
    ): string | null {

        if (supportedVersions[0] === currentVersion) {
            return currentVersion;
        }

           const parse = (v: string) => v.split(".").map(Number);

        const cmp = (a: number[], b: number[]): number => {
            for (let i = 0; i < 3; i++) {
                if (a[i] !== b[i]) return a[i] - b[i];
            }
            return 0;
        };

        const current = parse(currentVersion);

        // same-major supported versions, sorted ascending
        const sameMajor = supportedVersions
            .map(v => ({ v, p: parse(v) }))
            .filter(x => x.p[0] === current[0])
            .sort((a, b) => cmp(a.p, b.p));

        if (sameMajor.length === 0) return null;

        const latest = sameMajor[sameMajor.length - 1];

        // already latest
        if (cmp(current, latest.p) >= 0) {
            return latest.v;
        }

        // find the highest supported version <= current
        let floorIndex = -1;
        for (let i = 0; i < sameMajor.length; i++) {
            if (cmp(sameMajor[i].p, current) <= 0) {
                floorIndex = i;
            }
        }

        if (floorIndex === -1) return null;

        // exactly one hop to latest?
        if (floorIndex === sameMajor.length - 2) {
            return latest.v;
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
