import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import {
  ECSClient,
  ListTaskDefinitionsCommand,
  ListTaskDefinitionFamiliesCommand,
  DescribeTaskDefinitionCommand,
  KeyValuePair,
} from "@aws-sdk/client-ecs";
import inquirer from "inquirer";

const _SSMClient = new SSMClient({ region: "us-east-1" });
const _ECSClient = new ECSClient({ region: "us-east-1" });

export async function getTaskDefinitionName(containerName: string) {
  const res = await _ECSClient.send(
    new ListTaskDefinitionsCommand({
      familyPrefix: containerName,
      status: "ACTIVE",
      sort: "DESC",
      maxResults: 1,
    })
  );
  const taskDefName = res?.taskDefinitionArns?.[0]?.split("/")[1];
  if (!taskDefName) {
    throw new Error("No task definition found");
  }
  return taskDefName;
}

export async function getParameter(name: string) {
  const input = {
    // GetParameterequest
    Name: name.replace("arn:aws:ssm:us-east-1:080007210919:parameter/", ""),
    WithDecryption: true,
  };
  const command = new GetParameterCommand(input);
  try {
    const response = await _SSMClient.send(command);
    if (!response.Parameter?.Value) {
      throw new Error(`No value found for ${name}`);
    }
    return response.Parameter.Value;
  } catch (e) {
    return "ERROR_FETCHING";
  }
}

export async function getAllContainerNames() {
  console.log("getting all container names");
  const results = [];
  let res = await _ECSClient.send(
    new ListTaskDefinitionFamiliesCommand({ status: "ACTIVE" })
  );
  if (!res.families) {
    throw new Error("No families found");
  }
  results.push(...res.families);
  while (res.nextToken) {
    res = await _ECSClient.send(
      new ListTaskDefinitionFamiliesCommand({
        status: "ACTIVE",
        nextToken: res.nextToken,
      })
    );
    results.push(...(res?.families || []));
  }
  return results;
}

export async function getContainerDefinition(taskDefName: string) {
  // getting the task definition description
  const { taskDefinition } = await _ECSClient.send(
    new DescribeTaskDefinitionCommand({
      taskDefinition: taskDefName,
    })
  );
  if (!taskDefinition?.containerDefinitions?.[0]) {
    throw new Error("No container definition found");
  }

  let containerIndex = 0;
  if (taskDefinition.containerDefinitions.length > 1) {
    // inquire the user to select the index of the container definition
    containerIndex = (
      (await inquirer.prompt([
        {
          type: "list",
          name: "containerIndex",
          message: "Select container index",
          choices: taskDefinition.containerDefinitions.map(
            ({ name }, index) => ({
              name: name || `Container ${index}`,
              value: index,
            })
          ),
        },
      ])) as { containerIndex: number }
    ).containerIndex;
  }

  const containerDef = {
    environment:
      taskDefinition.containerDefinitions[containerIndex].environment || [],
    secrets: taskDefinition.containerDefinitions[containerIndex].secrets || [],
  };

  const sortStringAsc = (a: KeyValuePair, b: KeyValuePair) =>
    a.name?.localeCompare(b.name || "") || 0;

  containerDef.environment.sort(sortStringAsc);
  containerDef.secrets.sort(sortStringAsc);

  return containerDef;
}
