import { YAML } from "bun";
import { Logger } from "./logger";

export class Utils {

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

        Logger.info(`Updated docker-compose file content:\n${updated}`);

        await Bun.write(filePath, updated);
    }

}
