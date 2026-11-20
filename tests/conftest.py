"""Skip test modules whose optional dependencies (h5py, fastapi) are not installed."""
import importlib.util

collect_ignore = []
if importlib.util.find_spec("h5py") is None:
    collect_ignore += ["test_nisar_reader.py", "test_remote_and_previews.py"]
if importlib.util.find_spec("fastapi") is None:
    collect_ignore += ["test_api.py"]
