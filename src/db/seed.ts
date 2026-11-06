import { sqlClient } from "./client";
import { loadSampleData } from "./sample/load";

loadSampleData()
  .then(({ students }) => console.log(`Replayed the term for ${students} students.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
