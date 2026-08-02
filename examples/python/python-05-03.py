import tempfile, tomllib, venv
from pathlib import Path
project = tomllib.loads("[build-system]\nrequires=[\"setuptools\"]\nbuild-backend=\"setuptools.build_meta\"")
assert project["build-system"]["build-backend"] == "setuptools.build_meta"
with tempfile.TemporaryDirectory() as root:
    env = Path(root) / "venv"; venv.EnvBuilder(with_pip=False).create(env)
    assert (env / "pyvenv.cfg").exists()
