import type { Command } from "commander";
import { heading, info, success } from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  output,
} from "../../shared/helpers.js";
import {
  formatBootConfig,
  formatLinuxActivation,
  formatRescueActivation,
} from "../formatter.js";

export function registerBootCommands(parent: Command): void {
  const boot = parent
    .command("boot")
    .description("Boot configuration (rescue, linux, vnc, windows)");

  boot
    .command("status <server>")
    .description("Show boot configuration status")
    .action(
      asyncAction(
        async (client, serverIdOrIp: string, options: ActionOptions) => {
          const { boot: bootConfig } = await client.getBootConfig(serverIdOrIp);
          output(
            bootConfig,
            (b) => formatBootConfig(b, Number.parseInt(serverIdOrIp, 10) || 0),
            options
          );
        }
      )
    );

  const rescue = boot.command("rescue").description("Rescue system management");

  rescue
    .command("activate <server>")
    .description("Activate rescue system")
    .option(
      "-o, --os <os>",
      "Operating system (linux, linuxold, vkvm)",
      "linux"
    )
    .option("-a, --arch <arch>", "Architecture (64 or 32)", "64")
    .option("-k, --keys <fingerprints...>", "SSH key fingerprints")
    .action(
      asyncAction(
        async (
          client,
          serverIdOrIp: string,
          options: { os: string; arch: string; keys?: string[] }
        ) => {
          const { rescue: rsc } = await client.activateRescue(
            serverIdOrIp,
            options.os,
            Number.parseInt(options.arch, 10),
            options.keys
          );
          console.log(formatRescueActivation(rsc));
        }
      )
    );

  rescue
    .command("deactivate <server>")
    .description("Deactivate rescue system")
    .action(
      asyncAction(async (client, serverIdOrIp: string) => {
        await client.deactivateRescue(serverIdOrIp);
        console.log(success("Rescue system deactivated."));
      })
    );

  rescue
    .command("last <server>")
    .description("Show last rescue activation details")
    .action(
      asyncAction(
        async (client, serverIdOrIp: string, options: ActionOptions) => {
          const { rescue: rsc } = await client.getLastRescue(serverIdOrIp);
          output(rsc, formatRescueActivation, options);
        }
      )
    );

  const linux = boot
    .command("linux")
    .description("Linux installation management");

  linux
    .command("activate <server>")
    .description("Activate Linux installation")
    .requiredOption(
      "-d, --dist <dist>",
      "Distribution (e.g., Debian-1210-bookworm-amd64-base)"
    )
    .option("-a, --arch <arch>", "Architecture (64 or 32)", "64")
    .option("-l, --lang <lang>", "Language", "en")
    .option("-k, --keys <fingerprints...>", "SSH key fingerprints")
    .action(
      asyncAction(
        async (
          client,
          serverIdOrIp: string,
          options: { dist: string; arch: string; lang: string; keys?: string[] }
        ) => {
          const { linux: lnx } = await client.activateLinux(
            serverIdOrIp,
            options.dist,
            Number.parseInt(options.arch, 10),
            options.lang,
            options.keys
          );
          console.log(formatLinuxActivation(lnx));
        }
      )
    );

  linux
    .command("deactivate <server>")
    .description("Deactivate Linux installation")
    .action(
      asyncAction(async (client, serverIdOrIp: string) => {
        await client.deactivateLinux(serverIdOrIp);
        console.log(success("Linux installation deactivated."));
      })
    );

  linux
    .command("options <server>")
    .description("Show available Linux distributions")
    .action(
      asyncAction(
        async (client, serverIdOrIp: string, options: ActionOptions) => {
          const { linux: lnx } = await client.getLinux(serverIdOrIp);
          output(
            lnx,
            (l) => {
              const lines = [heading("Available Linux Distributions"), ""];
              for (const dist of l.dist) {
                lines.push(`  ${dist}`);
              }
              lines.push("", info(`Languages: ${l.lang.join(", ")}`));
              lines.push(info(`Architectures: ${l.arch.join(", ")}-bit`));
              return lines.join("\n");
            },
            options
          );
        }
      )
    );
}
