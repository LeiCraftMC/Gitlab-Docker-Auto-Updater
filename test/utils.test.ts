import { describe, test, expect } from "bun:test";
import { Utils } from "../src/utils/îndex";

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
});

