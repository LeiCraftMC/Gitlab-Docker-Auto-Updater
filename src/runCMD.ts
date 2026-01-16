import { CLIBaseCommand, CLICommandArg, CLICommandArgParser, type CLICommandContext } from "@cleverjs/cli";
import { NtfyService } from "./services/ntfy";
import { Logger } from "./utils/logger";
import { BackupService } from "./services/backup";
import { UpdateService } from "./services/update";
import { Utils } from "./utils";

const ARG_SPEC = CLICommandArg.defineCLIArgSpecs({
    flags: [

        // disabled for now
        // {
        //     name: "dry-run",
        //     description: "Perform a dry run without making any changes",
        //     type: "boolean"
        // },

        {
            name: "skip-backup",
            description: "Skip creating a backup before updating",
            type: "boolean"
        },
        {
            name: "delete-old-backups",
            description: "Delete backups older than the given time in days (default: 30). Set to 0 to disable deletion of old backups",
            type: "number",
            default: 30
        },
        {
            name: "backup-dir",
            description: "Directory to store backups. Defaults to './backups'",
            type: "string",
            default: "./backups"
        },
        {
            name: "gitlab-backup-dir",
            description: "Directory on the Host where Gitlab stores its backups. Defaults to '/var/opt/gitlab/backups'",
            type: "string",
            default: "/var/opt/gitlab/backups"
        },
        {
            name: "gitlab-env-file",
            description: "Path to the Gitlab .env file to include in the backup. By default, './.env' will be used if it exists",
            type: "string",
            default: "./.env"
        },
        

        {
            name: "docker-compose-file",
            description: "Path to the Docker Compose file. Defaults to './docker-compose.yml'",
            type: "string",
            default: "./docker-compose.yml"
        },
        {
            name: "docker-container-name",
            description: "Name of the Docker container running Gitlab. Defaults to 'gitlab' or the container_name specified in the Docker Compose file",
            type: "string",
            default: "gitlab"
        },

        {
            name: "ntfy-url",
            description: "URL for ntfy notifications. If not provided, notifications will not be sent",
            type: "string"
        },
        {
            name: "ntfy-auth-token",
            description: "Authentication token for ntfy notifications",
            type: "string"
        }
    ]
});

export class RunCommand extends CLIBaseCommand<typeof ARG_SPEC> {

    constructor() {
        super({
            name: "run",
            description: "Run the Gitlab Docker Auto Updater",
            args: ARG_SPEC
        });
    }

    private async handleCriticalError(ntfyService: NtfyService | null, error: string): Promise<never> {
        Logger.critical("Critical error:", error);
        if (ntfyService) {
            await ntfyService.notifyError("Critical error occurred", Logger.getLogHistory());
        }
        process.exit(1);
    }

    override async run(args: CLICommandArgParser.ParsedArgs<typeof ARG_SPEC>) {
        
        Logger.info("Starting Gitlab Docker Auto Updater...");

        const timestamp = Date.now();

        let ntfyService: NtfyService | null = null;
        let backupService: BackupService | null = null;

        if (args.flags["ntfy-url"]) {
            ntfyService = new NtfyService(
                args.flags["ntfy-url"],
                args.flags["ntfy-auth-token"]
            )
        }

        const updateService = new UpdateService(
            args.flags["docker-container-name"],
            args.flags["docker-compose-file"]
        );

        let currentVersion: string;
        let targetVersion: string;

        try {

            currentVersion = await Utils.getCurrentGitlabVersionFromContainer(args.flags["docker-container-name"]);

            const updateCheckResult = await updateService.checkUpdateCanBePerformed(
                currentVersion
            );

            if (updateCheckResult.status === "NO_SAFE_UPGRADE_PATH") {
                await ntfyService?.notifyWarning(`No safe upgrade path found from version ${currentVersion}. Update cannot be performed.`);
                return false;
            }

            if (updateCheckResult.status === "ALREADY_LATEST_VERSION") {
                await ntfyService?.notifySuccess(`Gitlab is already at the latest supported version (${currentVersion}). No update needed.`);
                return false;
            }

            if (updateCheckResult.status === "UPDATE_POSSIBLE" && updateCheckResult.targetVersion) {

                Logger.info(`Update available: ${currentVersion} -> ${updateCheckResult.targetVersion}`);

                targetVersion = updateCheckResult.targetVersion;
            } else {
                throw new Error("Unexpected update check result");
            }

        } catch (error) {
            await this.handleCriticalError(ntfyService, `Update check failed: ${Error.isError(error) ? error.message : error}`);
            return false;
        }



        if (!args.flags["skip-backup"]) {

            backupService = new BackupService(
                args.flags["backup-dir"],
                timestamp
            );

            try {
                await backupService.performFullBackup({
                    composeFilePath: args.flags["docker-compose-file"],
                    dockerContainerName: args.flags["docker-container-name"],
                    envFilePath: args.flags["gitlab-env-file"],
                    gitlabBackupDir: args.flags["gitlab-backup-dir"]
                });

            } catch (error) {
                await this.handleCriticalError(ntfyService, `Backup failed: ${Error.isError(error) ? error.message : error}`);
                return false;
            }

        } else {
            Logger.info("Skipping backup.");
        }


        try {
            await updateService.performUpdate(
                currentVersion,
                targetVersion
            );

            Logger.info(`Gitlab updated successfully to version ${targetVersion}.`);

        } catch (error) {
            await this.handleCriticalError(ntfyService, `Update failed: ${Error.isError(error) ? error.message : error}`);
            return false;
        }

        if (args.flags["delete-old-backups"] > 0 && backupService) {

            try {
                await backupService.deleteBackupsOlderThanDays(args.flags["delete-old-backups"]);
            } catch (error) {
                await this.handleCriticalError(ntfyService, `Failed to delete old backups: ${Error.isError(error) ? error.message : error}`);
                return false;
            }

        }

        Logger.info("Gitlab Docker Auto Updater finished.");
        await ntfyService?.notifySuccess("Gitlab Docker Auto Updater finished successfully.");
        return true;
    }

}
