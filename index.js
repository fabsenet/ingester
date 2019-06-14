const chalk = require("chalk");
const prompts = require("prompts");
const gracefulFs = require("graceful-fs");
const util = require("util");
const path = require("path");
const makeDir = require("make-dir");
const log = console.log;
const exec = require("child_process").exec;
const cpy = require("cpy");
const ProgressBar = require("progress");
const globby = require("globby");
const moment = require("moment");
const moveFile = require('move-file');

const fsReadDir = util.promisify(gracefulFs.readdir);
const fsExists = util.promisify(gracefulFs.exists);
const fsStat = util.promisify(gracefulFs.stat);
const fsRealpath = util.promisify(gracefulFs.realpath);
const fsReadfile = util.promisify(gracefulFs.readFile);
const fsWritefile = util.promisify(gracefulFs.writeFile);

(async () => {
  //TODO add global conf!
  const globalConfigFilename = path.resolve(process.env.USERPROFILE, "ingester.conf.json");
  let globalConfig;
  if (await fsExists(globalConfigFilename)) {
    globalConfig = JSON.parse(await fsReadfile(globalConfigFilename));
  } else {
    globalConfig = { projectsDir: "", sourceDir: "", sourceFilters: ["**/*.mp4"] };
    await fsWritefile(globalConfigFilename, JSON.stringify(globalConfig, undefined, 1));
  }
  if (!globalConfig.projectsDir) {
    exec(`explorer.exe /select,"${globalConfigFilename}"`);
    log(chalk.red("please edit the ingester.conf.json before doing any ingests!"));
    return;
  }

  let projectDirectories;
  try {
    projectDirectories = await fsReadDir(globalConfig.projectsDir);
  } catch {
    throw new Error(`failed to list projects in dir "${globalConfig.projectsDir}".`);
  }

  //remove with underscore
  projectDirectories = projectDirectories.filter(f => !f.startsWith("_") && f !== "Capture" && !f.match(/backup/i));

  //map to fullnames
  projectDirectories = await Promise.all(
    projectDirectories.map(async p => {
      return { name: p, fullPath: await fsRealpath(globalConfig.projectsDir + "/" + p) };
    })
  );

  //get stats
  projectDirectories = await Promise.all(
    projectDirectories.map(async p => {
      return { ...p, stat: await fsStat(p.fullPath) };
    })
  );

  //remove files
  projectDirectories = projectDirectories.filter(f => f.stat.isDirectory());

  //sort by modification time desc
  projectDirectories = projectDirectories.sort((f1, f2) => (f1.stat.mtime > f2.stat.mtime ? -1 : 1));

  const choices = [{ title: "*** exit ***", value: null }, ...projectDirectories.map(p => ({ title: p.name, value: p }))];
  //console.log(choices);
  const projectDir = (await prompts({
    type: "select",
    name: "value",
    message: "Select the project to ingest in",
    initial: 0,
    choices: choices
  })).value;
  if (projectDir === null) return;

  log("the target is " + chalk.green(projectDir.name));
  //load ingest.conf.json from project folder

  let config;

  const configFile = projectDir.fullPath + "/ingest.conf.json";
  if (await fsExists(configFile)) {
    //load existing config
    const configContent = await fsReadfile(configFile);
    config = JSON.parse(configContent);
  } else {
    //query user for new config
    log("the config for the project " + chalk.green(projectDir.name) + " must be created!");

    config = await prompts({
      type: "text",
      name: "prefix",
      message: "Enter the " + chalk.yellow("prefix") + " the ingested files should get"
    });
    if (!config.prefix) {
      log(chalk.red("project configuration initialisation cancelled!"));
      return;
    }
    config.ingestCount = 0;
  }
  log(`searching in ${chalk.green(globalConfig.sourceDir)} for files to ingest.`);
  var absoluteFiles = await globby(globalConfig.sourceFilters, {
    cwd: globalConfig.sourceDir,
    absolute: true,
    stats: true,
    case: false,
  });

  if (absoluteFiles.length === 0) {
    log(chalk.red("Could not find any files to ingest."));
    return;
  }

  config.ingestCount++;
  log(`this is ingest ${chalk.green(config.ingestCount)} for this project.`);
  const targetFolderPath = `${projectDir.fullPath}/raw ${config.ingestCount}/`.replace(/\//g, "\\");
  log(`targetFolderPath is ${chalk.green(targetFolderPath)}`);

  await makeDir(targetFolderPath);

  var totalSize = absoluteFiles.reduce((prev, cur) => prev + cur.size, 0);

  let mb = totalSize / 1024.0 / 1024.0;
  if (mb < 1000) { mb = mb.toPrecision(3); } else { mb = Math.round(mb); }
  log(`preparing to ingest ${chalk.green(absoluteFiles.length)} files with a size of ${chalk.green(mb)} mb.`);

  var copyProgress = new ProgressBar("[:bar] :percent :etas", { complete: chalk.green("="), total: totalSize, width: 35, incomplete: " " });


  var lastCompletedSize = 0;
  //actual copy
  await cpy(globalConfig.sourceFilters, targetFolderPath, {
    cwd: globalConfig.sourceDir,
    overwrite: false,
    rename: p => `${config.prefix}${p}`,
    case: false,
  }).on("progress", progress => {
    copyProgress.tick(progress.completedSize - lastCompletedSize);
    lastCompletedSize = progress.completedSize;
  });

  //rename originals to avoid double copy
  const suffix = `.copied.${moment().format("YYYY-MM-DD_hh-mm-ss")}.bak`
  await Promise.all(absoluteFiles.map(file => moveFile(file.path, file.path + suffix)));

  // save config
  await fsWritefile(configFile, JSON.stringify(config));

  exec(`explorer.exe /select,"${targetFolderPath}"`);
})();
