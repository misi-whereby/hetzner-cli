import type { Command } from "commander";
import { colorize, success, warning } from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  confirmAction,
  output,
} from "../../shared/helpers.js";
import {
  formatStorageBoxDetails,
  formatStorageBoxList,
  formatStorageBoxSnapshots,
  formatStorageBoxSubaccounts,
} from "../formatter.js";

export function registerStorageBoxCommands(parent: Command): void {
  const storagebox = parent
    .command("storagebox")
    .alias("storage")
    .description("Storage Box management");

  storagebox
    .command("list")
    .alias("ls")
    .description("List all storage boxes")
    .action(
      asyncAction(async (client, options: ActionOptions) => {
        const boxes = await client.listStorageBoxes();
        output(boxes, formatStorageBoxList, options);
      })
    );

  storagebox
    .command("get <id>")
    .alias("show")
    .description("Get storage box details")
    .action(
      asyncAction(async (client, boxId: string, options: ActionOptions) => {
        const { storagebox: box } = await client.getStorageBox(
          Number.parseInt(boxId, 10)
        );
        output(box, formatStorageBoxDetails, options);
      })
    );

  storagebox
    .command("update <id>")
    .description("Update storage box settings")
    .option("-n, --name <name>", "Storage box name")
    .option("--webdav <enabled>", "Enable/disable WebDAV")
    .option("--samba <enabled>", "Enable/disable Samba/CIFS")
    .option("--ssh <enabled>", "Enable/disable SSH/SFTP")
    .option("--external <enabled>", "Enable/disable external reachability")
    .option("--zfs <enabled>", "Enable/disable ZFS")
    .action(
      asyncAction(
        async (
          client,
          boxId: string,
          options: {
            name?: string;
            webdav?: string;
            samba?: string;
            ssh?: string;
            external?: string;
            zfs?: string;
          }
        ) => {
          await client.updateStorageBox(
            Number.parseInt(boxId, 10),
            options.name,
            options.webdav ? options.webdav === "true" : undefined,
            options.samba ? options.samba === "true" : undefined,
            options.ssh ? options.ssh === "true" : undefined,
            options.external ? options.external === "true" : undefined,
            options.zfs ? options.zfs === "true" : undefined
          );
          console.log(success("Storage box updated."));
        }
      )
    );

  storagebox
    .command("reset-password <id>")
    .description("Reset storage box password")
    .action(
      asyncAction(async (client, boxId: string) => {
        const { password } = await client.resetStorageBoxPassword(
          Number.parseInt(boxId, 10)
        );
        console.log(success("Password reset."));
        console.log(`New password: ${colorize(password, "yellow")}`);
      })
    );

  const snapshot = storagebox
    .command("snapshot")
    .description("Storage box snapshot management");

  snapshot
    .command("list <box-id>")
    .alias("ls")
    .description("List storage box snapshots")
    .action(
      asyncAction(async (client, boxId: string, options: ActionOptions) => {
        const snapshots = await client.listStorageBoxSnapshots(
          Number.parseInt(boxId, 10)
        );
        output(snapshots, formatStorageBoxSnapshots, options);
      })
    );

  snapshot
    .command("create <box-id>")
    .description("Create a new snapshot")
    .action(
      asyncAction(async (client, boxId: string) => {
        const { snapshot: snap } = await client.createStorageBoxSnapshot(
          Number.parseInt(boxId, 10)
        );
        console.log(success(`Snapshot created: ${snap.name}`));
      })
    );

  snapshot
    .command("delete <box-id> <name>")
    .alias("rm")
    .description("Delete a snapshot")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (
          client,
          boxId: string,
          snapshotName: string,
          options: ActionOptions
        ) => {
          if (
            !(await confirmAction(`Delete snapshot ${snapshotName}?`, options))
          ) {
            return;
          }
          await client.deleteStorageBoxSnapshot(
            Number.parseInt(boxId, 10),
            snapshotName
          );
          console.log(success("Snapshot deleted."));
        }
      )
    );

  snapshot
    .command("revert <box-id> <name>")
    .description("Revert to a snapshot")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (
          client,
          boxId: string,
          snapshotName: string,
          options: ActionOptions
        ) => {
          if (!options.yes) {
            console.log(
              warning(
                "This will revert your storage box to the snapshot state."
              )
            );
          }
          if (
            !(await confirmAction(
              `Revert to snapshot ${snapshotName}?`,
              options
            ))
          ) {
            return;
          }
          await client.revertStorageBoxSnapshot(
            Number.parseInt(boxId, 10),
            snapshotName
          );
          console.log(success("Reverted to snapshot."));
        }
      )
    );

  const subaccount = storagebox
    .command("subaccount")
    .description("Storage box subaccount management");

  subaccount
    .command("list <box-id>")
    .alias("ls")
    .description("List storage box subaccounts")
    .action(
      asyncAction(async (client, boxId: string, options: ActionOptions) => {
        const subaccounts = await client.listStorageBoxSubaccounts(
          Number.parseInt(boxId, 10)
        );
        output(subaccounts, formatStorageBoxSubaccounts, options);
      })
    );

  subaccount
    .command("create <box-id> <home-directory>")
    .description("Create a new subaccount")
    .option("--samba <enabled>", "Enable Samba")
    .option("--ssh <enabled>", "Enable SSH")
    .option("--webdav <enabled>", "Enable WebDAV")
    .option("--external <enabled>", "Enable external reachability")
    .option("--readonly <enabled>", "Read-only access")
    .option("--comment <comment>", "Comment")
    .action(
      asyncAction(
        async (
          client,
          boxId: string,
          homeDir: string,
          options: {
            samba?: string;
            ssh?: string;
            webdav?: string;
            external?: string;
            readonly?: string;
            comment?: string;
          }
        ) => {
          const { subaccount: sub } = await client.createStorageBoxSubaccount(
            Number.parseInt(boxId, 10),
            homeDir,
            options.samba ? options.samba === "true" : undefined,
            options.ssh ? options.ssh === "true" : undefined,
            options.external ? options.external === "true" : undefined,
            options.webdav ? options.webdav === "true" : undefined,
            options.readonly ? options.readonly === "true" : undefined,
            options.comment
          );
          console.log(success(`Subaccount created: ${sub.username}`));
        }
      )
    );

  subaccount
    .command("delete <box-id> <username>")
    .alias("rm")
    .description("Delete a subaccount")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (
          client,
          boxId: string,
          username: string,
          options: ActionOptions
        ) => {
          if (
            !(await confirmAction(`Delete subaccount ${username}?`, options))
          ) {
            return;
          }
          await client.deleteStorageBoxSubaccount(
            Number.parseInt(boxId, 10),
            username
          );
          console.log(success("Subaccount deleted."));
        }
      )
    );
}
