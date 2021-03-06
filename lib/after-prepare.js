const { installSnapshotArtefacts } = require("../snapshot/android/project-snapshot-generator");
const { shouldSnapshot } = require("./utils");

module.exports = function ($projectData, hookArgs) {
	const env = hookArgs.env || {};
	const shouldSnapshotOptions = {
		platform: hookArgs.platform,
		bundle: hookArgs.appFilesUpdaterOptions.bundle,
		release: hookArgs.appFilesUpdaterOptions.release
	};

	if (env.snapshot && shouldSnapshot(shouldSnapshotOptions)) {
		installSnapshotArtefacts($projectData.projectDir);
	}
}
