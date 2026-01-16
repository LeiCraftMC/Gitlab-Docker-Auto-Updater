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
        const latestVersions = await Utils.getLatestGitlabVersions();
        const versionRegex = /^\d+\.\d+\.\d+$/;
        expect(versionRegex.test(latestVersions[0] as string)).toBe(true);
    });

    test("isUpgradeDoable correctly compares versions", () => {

        const versions = [
            "18.8.0",
            "18.7.0",
            "18.6.0",
        ]

        expect(Utils.isUpgradeDoable("18.7.1", "18.8.0")).toBe(true);
        expect(Utils.isUpgradeDoable("18.8.0", "18.7.1")).toBe(false);
        expect(Utils.isUpgradeDoable("18.7.1", "18.7.1")).toBe(false);
        expect(Utils.isUpgradeDoable("18.7.9", "18.8.0")).toBe(true);
        expect(Utils.isUpgradeDoable("18.9.0", "19.0.0")).toBe(true);
        
        // case with major version change
        expect(Utils.isUpgradeDoable("16.9.0", "18.0.0")).toBe(false);
        expect(Utils.isUpgradeDoable("16.0.0", "18.0.0")).toBe(false);

    });

});

