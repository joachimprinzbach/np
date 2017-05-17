'use strict';
const execa = require('execa');
const Listr = require('listr');
const version = require('./version');

module.exports = (input, pkg, opts) => {
	let newVersion = null;

	const tasks = [
		{
			title: 'Validate version',
			task: () => {
				if (!version.isValidVersionInput(input)) {
					throw new Error(`Version should be either ${version.SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`);
				}

				newVersion = version.getNewVersion(pkg.version, input);

				if (!version.isVersionGreater(pkg.version, newVersion)) {
					throw new Error(`New version \`${newVersion}\` should be higher than current version \`${pkg.version}\``);
				}
			}
		},
		{
			title: 'Check for pre-release version',
			enabled: () => opts.publish,
			task: () => {
				if (!pkg.private && version.isPrereleaseVersion(newVersion) && !opts.tag) {
					throw new Error('You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag');
				}
			}
		},
		{
			title: 'Check git tag existence',
			task: () => execa('git', ['fetch'])
				.then(() => execa.stdout('git', ['rev-parse', '--quiet', '--verify', `refs/tags/v${newVersion}`]))
				.then(
					output => {
						if (output) {
							throw new Error(`Git tag \`v${newVersion}\` already exists.`);
						}
					},
					err => {
						// Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
						// https://github.com/sindresorhus/np/pull/73#discussion_r72385685
						if (err.stdout !== '' || err.stderr !== '') {
							throw err;
						}
					}
				)
		}
	];

	return new Listr(tasks);
};
