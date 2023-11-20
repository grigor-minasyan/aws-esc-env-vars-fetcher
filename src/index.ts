#!/usr/bin/env node
import {
  getAllContainerNames,
  getContainerDefinition,
  getParameter,
  getTaskDefinitionName,
} from "./utils";
import pLimit from "p-limit";
import inquirer from "inquirer";
import cliProgress from "cli-progress";

(async () => {
  // Setting AWS profile
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "awsProfile",
      message: "Enter AWS profile name",
      default: "asurion-simplr-nonprod_dev",
    },
  ]);

  process.env["AWS_PROFILE"] = answers.awsProfile;

  // getting keywords for search
  const { keywords } = (await inquirer.prompt([
    {
      type: "input",
      name: "keywords",
      message: "Enter space separated keywords to search for container names",
      default: "logic processor qa",
    },
  ])) as { keywords: string };

  const allContainerNames = await getAllContainerNames();

  const filteredContainerNames = allContainerNames.filter((containerName) =>
    keywords
      .toLowerCase()
      .split(" ")
      .every((keyword) => containerName.toLowerCase().includes(keyword))
  );

  const { containerName } = (await inquirer.prompt([
    {
      type: "list",
      name: "containerName",
      message: "Select container name",
      choices: filteredContainerNames,
    },
  ])) as { containerName: string };

  const taskDefName = await getTaskDefinitionName(containerName);

  let finalEnv = "# Non secret environment\n\n";

  const containerDef = await getContainerDefinition(taskDefName);

  containerDef.environment.forEach((env) => {
    finalEnv += `${env.name}=${env.value}\n`;
  });

  finalEnv += "\n# Secrets\n\n";

  const limit = pLimit(5);

  const progressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progressBar.start(containerDef.secrets.length, 0);

  let progress = 0;
  const envVarsToAppend = await Promise.all(
    containerDef.secrets.map((secret) =>
      limit(async () => {
        if (!secret.valueFrom) {
          throw new Error("No valueFrom found");
        }
        const value = await getParameter(secret.valueFrom);
        progressBar.update(++progress);
        return `${secret.name}=${value}\n`;
      })
    )
  );

  progressBar.stop();

  envVarsToAppend.forEach((envVar) => (finalEnv += envVar));

  console.log(
    "# ------------------------------------------------------------------------------------------------------------------------------------"
  );
  console.log(finalEnv);
  console.log(
    "# ------------------------------------------------------------------------------------------------------------------------------------"
  );
})();
