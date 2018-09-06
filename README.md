# ingester

a script to ingest media files from a memory card in an opinionated projects structure

## What can ingester do for you?

When cutting videos, I have to copy video files from memory cards into the project structure several times.
Ingester can help you do this by renaming video files, selecting (and creating) the correct subfolder
and by opening the ingested media folder after execution.

## What is opinionated in ingester?

Ingester assumes some facts about your PC and your folder structure:

- You use a Windows PC (ingester is 90% cross-platform but there are probably some adaptations needed. Make a PR if you want!)
- Your memory card always gets the same drive letter. Ingester uses a configured source folder.
- All your relevant video projects have the same parent folder
- Every video project has its own folder
- Every ingest is done in a new subfolder within a project

### Expected projects structure sample

```text
C:\video projects
├───Project A
│   ├───raw media 1
│   ├───raw media 2
│   └───raw media 3
├───Project B
│   ├───raw media 1
│   ├───raw media 2
│   └───raw media 3
└───Project C
    ├───raw media 1
    ├───raw media 2
    └───raw media 3
```

## Show me

### install and first global run

```powershell
cd c:\scripts
git clone https://github.com/fabsenet/ingester.git
cd ingester
npm install
node index.js
```

> please edit the ingester.conf.json before doing any ingests!

The explorer window opens with the ingester.conf.json file preselected. Edit this file your favorit text editor
and provide your source directory and your projects directory:

The following sample assumes your memory card always gets the drive letter J: and the projects directory is the
same as above:

```json
{
  "projectsDir": "C:\\video projects",
  "sourceDir": "J:\\",
  "sourceFilters": ["**/*.mp4"]
}
```

### first ingest run for a project

After inserting the memory card, run `node index.js`:

```text
? Select the project to ingest in » - Use arrow-keys. Return to submit.
>  Project C
   Project B
   Project A
```

Ingester lists all Projects order by last modified date descending. This assumes you have some old projects but always
working on the new ones. Selecting `Project C` yields:

```text
√ Select the project to ingest in » Project C
the target is Project C
the config for the project Project C must be created!
? Enter the prefix the ingested files should get »
```

Ingester wants to know the prefix for renaming the files. I enter `PC_`:

```text
searching in J:\ for files to ingest.
this is ingest 1 for this project.
targetFolderPath is C:\video projects\Project C\raw 1\
preparing to ingest 6 files with a size of 238 mb.
[====================================] 100% 0.0s
```

It now has copied all media files from the memory card and opens an explorer window preselecting the new folder.
`raw 1` in this case. You are now free to format the memory card and to add the media files into your video editor or whatever.

### every next run for a project

After the project is initialized, ingester will present the project selection as you may want to ingest for another
project instead and simply do its job without further asking any other stuff. It will always open the folder after ingesting.
