import fs from "fs/promises";
import { Logger } from "../utils/logger";

export class BackupService {

    constructor(
        protected readonly backupBasePath: string,
        protected readonly timestamp: number
    ) {}

    public getBackupPath(): string {
        return `${this.backupBasePath}/backup-${this.timestamp.toString()}`;
    }

    public async backupComposeFile(composeFilePath: string): Promise<void> {
        const backupPath = this.getBackupPath();
        
        try {
            await fs.mkdir(backupPath, { recursive: true });

            const fileName = composeFilePath.split("/").pop();
            if (!fileName) {
                throw new Error("Invalid compose file path");
            }
            const destinationPath = `${backupPath}/${fileName}`;
            await fs.copyFile(composeFilePath, destinationPath);

            Logger.info(`Backed up compose file to: ${destinationPath}`);

        } catch (error) {
            throw error;
        }
    }

    public async backupEnvFileIfExists(envFilePath: string): Promise<void> {
        try {

            if (!await fs.access(envFilePath).then(() => true).catch(() => false)) {
                Logger.info("No .env file found to backup.");
                return;
            }

            const backupPath = this.getBackupPath();
            const fileName = envFilePath.split("/").pop();
            if (!fileName) {
                throw new Error("Invalid env file path");
            }
            const destinationPath = `${backupPath}/${fileName}`;
            await fs.copyFile(envFilePath, destinationPath);

            Logger.info(`Backed up env file to: ${destinationPath}`);

        } catch (error) {
            throw error;
        }
    }

    public async createGitlabBackup(dockerContainerName: string, gitlabBackupDir: string): Promise<void> {

        Logger.info("Creating Gitlab backup inside the Docker container...");

        const exec = Bun.spawn({
            cmd: ["docker", "exec", "-t", dockerContainerName, "gitlab-backup", "create", `BACKUP=gitlab-auto-updater-backup-${this.timestamp.toString()}`],
            stdout: "pipe",
            stderr: "pipe"
        });

        const stdoutPromise = (async () => {
            for await (const chunk of exec.stdout!) {
                const text = new TextDecoder().decode(chunk);
                Logger.info(`[Gitlab Backup] ${text.trim()}`);
            }
        })();
        
        const stderrPromise = (async () => {
            for await (const chunk of exec.stderr!) {
                const text = new TextDecoder().decode(chunk);
                Logger.error(`[Gitlab Backup ERROR] ${text.trim()}`);
            }
        })();

        await Promise.all([stdoutPromise, stderrPromise, exec.exited]);

        const exitCode = await exec.exited;

        if (exitCode !== 0) {
            throw new Error(`Gitlab backup command failed with exit code ${exec.exitCode}`);
        }
        
        // move the created backup to the backup path for the auto updater
        const gitlabBackupFilePath = `${gitlabBackupDir}/gitlab-auto-updater-backup-${this.timestamp}_gitlab_backup.tar`;
        const backupPath = this.getBackupPath();
        const destinationPath = `${backupPath}/gitlab_backup.tar`;

        if (!await fs.access(gitlabBackupFilePath).then(() => true).catch(() => false)) {
            throw new Error(`Expected Gitlab backup file not found at: ${gitlabBackupFilePath}`);
        }

        if (!await fs.access(backupPath).then(() => true).catch(() => false)) {
            await fs.mkdir(backupPath, { recursive: true });
        }

        try {
            await fs.rename(gitlabBackupFilePath, destinationPath);
        } catch (error) {
            Logger.error("Failed to move Gitlab backup file:", error);
            throw error;
        }

        Logger.info("Gitlab backup completed successfully.");
    }

    public async performFullBackup(opts: {
        composeFilePath: string; 
        dockerContainerName: string; 
        envFilePath: string; 
        gitlabBackupDir: string
    }): Promise<void> {
        await this.backupComposeFile(opts.composeFilePath);
        await this.backupEnvFileIfExists(opts.envFilePath);
        await this.createGitlabBackup(opts.dockerContainerName, opts.gitlabBackupDir);
    }

    public async deleteBackupsOlderThanDays(days: number): Promise<void> {

        if (days <= 0) {
            Logger.info("Deletion of old backups is disabled.");
            return;
        }

        const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
        try {
            const files = await fs.readdir(this.backupBasePath);

            for (const file of files) {

                const filePath = `${this.backupBasePath}/${file}`;

                const stats = await fs.stat(filePath);

                if (stats.isDirectory() && stats.mtimeMs < cutoffDate) {

                    await fs.rm(filePath, { recursive: true, force: true });

                    Logger.info(`Deleted old backup: ${filePath}`);
                }
            }
        } catch (error) {
            Logger.error("Failed to delete old backups:", error);
        }
    }

}