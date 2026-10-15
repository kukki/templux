#!/usr/bin/env python3
"""Pure host wrapper regression: fake Docker only; no DB, real Docker or credentials."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
VALUES = {'--mode': 'original', '--target': 'current', '--archive': '/private/selected.dump', '--sha256': 'a' * 64}

def command_without(option):
    return ['restore', '--confirm', '--overwrite'] + [part for k, v in VALUES.items() if k != option for part in (k, v)]

class RestoreWrapper(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='templux-wrapper-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        docker = self.directory / 'docker'
        docker.write_text('''#!/bin/sh
printf 'called\\n' >> "$TEMPLUX_STUB_CALLS"
for arg in "$@"; do
  if [ "$arg" = auth-config-probe ]; then printf '{}\\n'; exit 0; fi
done
printf '%s\\0' "$@" > "$TEMPLUX_STUB_ARGS"
printf '{"ok":true,"stub":true}\\n'
''')
        docker.chmod(0o700)
        self.env = {**os.environ, 'PATH': str(self.directory) + ':/usr/bin:/bin',
                    'TEMPLUX_STUB_CALLS': str(self.directory / 'calls'),
                    'TEMPLUX_STUB_ARGS': str(self.directory / 'args'),
                    'TEMPLUX_HOST_UID': '0', 'TEMPLUX_HOST_GID': '0'}
        self.env.pop('TEMPLUX_RESTORE_ADMIN_URL', None)

    def run_wrapper(self, args):
        return subprocess.run(['/bin/sh', str(ROOT / 'templux'), *args], env=self.env,
                              capture_output=True, text=True, timeout=5)

    def assert_rejected(self, args, json_mode=True):
        result = self.run_wrapper(args)
        self.assertEqual(result.returncode, 1)
        self.assertFalse((self.directory / 'calls').exists(), 'incomplete restore called Docker')
        if json_mode:
            self.assertEqual(len(result.stdout.splitlines()), 1)
            self.assertFalse(json.loads(result.stdout)['ok'])
            self.assertEqual(result.stderr, '')
        else:
            self.assertEqual(result.stdout, '')
            self.assertIn('restore requires', result.stderr)

    def test_human_missing_value_uses_stderr(self):
        self.assert_rejected(command_without('--archive') + ['--archive'], False)

    def test_complete_arguments_preserve_spaces_and_one_token_paths(self):
        args = command_without('--archive') + ['--archive', '/private/Example Archives/--selected dump.dump', '--json']
        result = self.run_wrapper(args)
        self.assertEqual(result.returncode, 0)
        self.assertTrue(json.loads(result.stdout)['ok'])
        self.assertEqual((self.directory / 'calls').read_text().splitlines(), ['called', 'called'])
        forwarded = (self.directory / 'args').read_bytes().decode().split('\0')[:-1]
        self.assertEqual(forwarded[forwarded.index('management') + 1:], args)

    def test_leading_option_filename_is_rejected_with_absolute_path_guidance(self):
        result = self.run_wrapper(command_without('--archive') + ['--archive', '--selected.dump', '--json'])
        self.assertEqual(result.returncode, 1)
        self.assertFalse((self.directory / 'calls').exists())
        self.assertIn('/approved/--selected.dump', json.loads(result.stdout)['error'])

    def test_named_target_passes_key_without_exposing_value(self):
        self.env['TEST_RESTORE_WRAPPER_TARGET'] = 'synthetic-not-a-connection'
        args = command_without('--target') + ['--target', 'env:TEST_RESTORE_WRAPPER_TARGET', '--json']
        result = self.run_wrapper(args)
        self.assertEqual(result.returncode, 0)
        forwarded = (self.directory / 'args').read_bytes().decode().split('\0')[:-1]
        self.assertIn('TEST_RESTORE_WRAPPER_TARGET', forwarded)
        self.assertNotIn(self.env['TEST_RESTORE_WRAPPER_TARGET'], forwarded)
        self.assertEqual(forwarded[forwarded.index('management') + 1:], args)

    def test_menu_keeps_normal_docker_forwarding(self):
        result = self.run_wrapper([])
        self.assertEqual(result.returncode, 0)
        forwarded = (self.directory / 'args').read_bytes().decode().split('\0')[:-1]
        self.assertEqual(forwarded[-1], 'management')

    def test_top_level_help_keeps_existing_forwarding(self):
        result = self.run_wrapper(['--help'])
        self.assertEqual(result.returncode, 0)
        forwarded = (self.directory / 'args').read_bytes().decode().split('\0')[:-1]
        self.assertEqual(forwarded[-2:], ['management', '--help'])

for option in VALUES:
    prefix = command_without(option)
    cases = {
        'empty': prefix + [option, '', '--json'],
        'eof': prefix + ['--json', option],
        'next_json': prefix + [option, '--json'],
        'next_flag_json_before': prefix + ['--json', option, '--non-interactive'],
        'next_flag_json_after': prefix + [option, '--non-interactive', '--json'],
        'next_value_option': prefix + [option, '--archive', '--json'],
        'equals_empty': prefix + [option + '=', '--json'],
        'extra_equals_empty': ['restore'] + [part for k,v in VALUES.items() for part in (k,v)] + ['--confirm','--overwrite',option+'=','--json'],
    }
    for label, args in cases.items():
        def regression(self, args=args):
            self.assert_rejected(args)
        setattr(RestoreWrapper, 'test_' + option[2:] + '_' + label, regression)

if __name__ == '__main__':
    unittest.main(verbosity=2)
