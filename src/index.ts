import dotenv from "dotenv";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import {
  ECSClient,
  ListTaskDefinitionsCommand,
  ListTaskDefinitionFamiliesCommand,
  DescribeTaskDefinitionCommand,
  KeyValuePair,
} from "@aws-sdk/client-ecs";

dotenv.config();

const _SSMClient = new SSMClient({ region: "us-east-1" });
const _ECSClient = new ECSClient({ region: "us-east-1" });

const CONTAINER_NAME = "nvsimplr-simplr-chat-server-qa";

function getShortParamName(name: string) {
  return name.replace("arn:aws:ssm:us-east-1:080007210919:parameter/", "");
}

async function getParameter(name: string) {
  const input = {
    // GetParameterequest
    Name: getShortParamName(name),
    WithDecryption: true,
  };
  const command = new GetParameterCommand(input);
  const response = await _SSMClient.send(command);
  if (!response.Parameter?.Value) {
    throw new Error(`No value found for ${name}`);
  }
  return response.Parameter.Value;
}

async function getAllContainerNames() {
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

async function getTaskDefinitionName() {
  // console.log(await getAllContainerNames());

  const res = await _ECSClient.send(
    new ListTaskDefinitionsCommand({
      familyPrefix: CONTAINER_NAME,
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

const sortStringAsc = (a: KeyValuePair, b: KeyValuePair) =>
  a.name?.localeCompare(b.name || "") || 0;

async function getContainerDefinition(taskDefName: string) {
  // getting the task definition description
  const { taskDefinition } = await _ECSClient.send(
    new DescribeTaskDefinitionCommand({
      taskDefinition: taskDefName,
    })
  );
  if (!taskDefinition?.containerDefinitions?.[0]) {
    throw new Error("No container definition found");
  }
  const containerDef = {
    environment: taskDefinition.containerDefinitions[0].environment || [],
    secrets: taskDefinition.containerDefinitions[0].secrets || [],
  };

  containerDef.environment.sort(sortStringAsc);
  containerDef.secrets.sort(sortStringAsc);

  return containerDef;
}

(async () => {
  const taskDefName = await getTaskDefinitionName();

  let finalEnv = "# Non secret environment\n\n";

  const simplrServerEnv = await getContainerDefinition(taskDefName);

  simplrServerEnv.environment.forEach((env) => {
    finalEnv += `${env.name}=${env.value}\n`;
  });

  finalEnv += "\n# Secrets\n\n";

  const pLimit = await import("p-limit");
  const limit = pLimit.default(10);

  const envVarsToAppend = await Promise.all(
    simplrServerEnv.secrets.map((secret) =>
      limit(async () => {
        if (!secret.valueFrom) {
          throw new Error("No valueFrom found");
        }
        const value = await getParameter(secret.valueFrom);
        console.log("received", secret.name);
        return `${secret.name}=${value}\n`;
      })
    )
  );

  envVarsToAppend.forEach((envVar) => (finalEnv += envVar));

  console.log(
    "# ------------------------- Final ENV vars -------------------------"
  );
  console.log(finalEnv);
  console.log(
    "# ------------------------------------------------------------------"
  );
})();
