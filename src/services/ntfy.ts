import { Logger } from "../utils/logger";

export class NtfyService {

    constructor(
        protected readonly ntfyUrl: string,
        protected readonly authToken?: string
    ) {}

    protected async sendNotification(title: string, message: string, type: "success" | "warning" | "error"): Promise<void> {
        const response = await fetch(this.ntfyUrl, {
            method: "POST",
            headers: {
                "Title": title,
                "Priority": type === "success" ? "1" : "5",
                "Tags": `gitlab-updater,${type === "success" ? "white_check_mark" : type === "warning" ? "warning" : "x"}`,

                ...(this.authToken ? {
                    "Authorization": `Bearer ${this.authToken}`
                } : {})
            },
            body: message
        });
        if (!response.ok) {
            throw new Error(`Failed to send notification: ${response.statusText}`);
        }
        Logger.info("Notification sent successfully.");
    }

    async notifySuccess(message: string): Promise<void> {
        await this.sendNotification("Gitlab Update Successful", message, "success");
    }

    async notifyWarning(message: string): Promise<void> {
        await this.sendNotification("Gitlab Update Warning", message, "warning");
    }

    async notifyError(message: string, logLines: string[]): Promise<void> {
        await this.sendNotification("Gitlab Update Failed", `${message}\n\nLogs:\n${logLines.join("\n")}`, "error");
    }

}
