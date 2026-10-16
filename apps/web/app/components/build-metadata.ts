const month = process.env.NEXT_PUBLIC_BUILD_MONTH?.trim() ?? '';
const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT?.trim() ?? '';

export const buildMetadata = Object.freeze({
  month: /^\d{4}-\d{2}$/.test(month) ? month.replace('-', '') : 'unknown',
  commit: /^[0-9a-f]{7,64}$/i.test(commit) ? commit.slice(0, 7) : 'unknown',
});

export const buildVersionLabel = `${buildMetadata.month} - COMMIT ${buildMetadata.commit}`;
