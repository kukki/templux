import {readFileSync} from 'node:fs';
import {join} from 'node:path';

function readOptional(path) {
  try { return readFileSync(path, 'utf8').trim(); }
  catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error; }
}

function commitFromGit(root) {
  const git = join(root, '.git');
  const head = readOptional(join(git, 'HEAD'));
  if (!head) return null;
  if (!head.startsWith('ref: ')) return head;
  const ref = head.slice(5);
  if (!/^refs\/[\w./-]+$/.test(ref) || ref.split('/').includes('..')) throw new Error('无法识别的 Git HEAD 引用。');
  const loose = readOptional(join(git, ref));
  if (loose) return loose;
  const packed = readOptional(join(git, 'packed-refs'))?.split('\n')
    .find((line) => !line.startsWith('#') && line.endsWith(' ' + ref))?.split(' ')[0];
  if (!packed) throw new Error('无法解析 Git HEAD 引用：' + ref);
  return packed;
}

function projectTimeZone(root) {
  try { return JSON.parse(readFileSync(join(root, 'config/presentation.json'), 'utf8'))?.time?.timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

function currentMonth(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit'}).formatToParts(new Date());
  return parts.find((part) => part.type === 'year').value + '-' + parts.find((part) => part.type === 'month').value;
}

const root = process.cwd();
const commit = commitFromGit(root);
if (!commit || !/^[0-9a-f]{7,64}$/i.test(commit)) throw new Error('无法确定构建提交：请在 Git 检出中构建（或设置 TEMPLUX_BUILD_COMMIT）。');
process.stdout.write(currentMonth(projectTimeZone(root)) + '\n' + commit.toLowerCase() + '\n');
