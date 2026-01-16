import { describe, test, expect } from "bun:test";
import { Utils } from "../src/utils";

describe("Utility Testing Suite", () => {

    test("replaceGitlabVersionInComposeFile updates version correctly", async () => {

        const testFilePath = "./test/assets/sample.docker-compose.yml";

        const oldVersion = "18.7.1";
        const newVersion = "18.8.0";

        const oldContent = await Bun.file(testFilePath).text();
        expect(oldContent).toContain(`image: 'gitlab/gitlab-ce:${oldVersion}-ce.0'`);

        await Utils.replaceGitlabVersionInComposeFile(testFilePath, oldVersion, newVersion);

        const updatedContent = await Bun.file(testFilePath).text();
        expect(updatedContent).toContain(`image: 'gitlab/gitlab-ce:${newVersion}-ce.0'`);


        // Revert changes for idempotent tests
        await Utils.replaceGitlabVersionInComposeFile(testFilePath, newVersion, oldVersion);

        const revertedContent = await Bun.file(testFilePath).text();
        expect(revertedContent).toBe(oldContent);

    });

    test("getLatestGitlabVersion returns a valid version string", async () => {
        const latestVersions = await Utils.getLatestSupportedGitlabVersions();
        const versionRegex = /^\d+\.\d+\.\d+$/;
        expect(versionRegex.test(latestVersions[0] as string)).toBe(true);
    });

    test("isUpgradeDoable correctly compares versions", () => {

        const supportedVersions = ["17.1.8","17.3.7","17.5.5","17.8.7","17.11.7","18.2.8","18.5.5","18.8.0"].reverse();

        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.5.5")).toBe("18.8.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.5.6")).toBe("18.8.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.6.0")).toBe("18.8.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.7.0")).toBe("18.8.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.7.1")).toBe("18.8.0");

        // already latest
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.8.0")).toBe("18.8.0");

        // cant be done in one step
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.2.8")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "17.11.7")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "17.8.7")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "17.5.4")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "16.12.0")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "19.0.0")).toBeNull();

        

        const supportedVersions2 = ["18.8.0", "19.0.0"].reverse();

        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions2, "18.8.5")).toBe("19.0.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions2, "18.8.6")).toBe("19.0.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions2, "18.9.0")).toBe("19.0.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions2, "18.9.0")).toBe("19.0.0");
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions2, "18.9.1")).toBe("19.0.0");

        // already latest
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions2, "19.0.0")).toBe("19.0.0");

        // cant be done in one step
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "18.2.8")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "17.11.7")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "17.8.7")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "17.5.4")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "16.12.0")).toBeNull();
        expect(Utils.getNextSafeGitlabUpgrade(supportedVersions, "20.0.0")).toBeNull();
    });

});

