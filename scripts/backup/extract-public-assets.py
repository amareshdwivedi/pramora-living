#!/usr/bin/env python3
"""Extract only regular public/ files from the pinned GitHub source archive."""
import json,pathlib,sys,tarfile
archive=pathlib.Path(sys.argv[1])
dest=pathlib.Path(sys.argv[2]).resolve()
manifest_only='--manifest-only' in sys.argv
with tarfile.open(archive,'r:gz') as tar:
    records=[]
    for member in tar.getmembers():
        parts=pathlib.PurePosixPath(member.name).parts
        if pathlib.PurePosixPath(member.name).is_absolute() or '..' in parts:
            raise SystemExit('Unsafe path in source archive.')
        if len(parts)<3 or parts[1]!='public' or not member.isfile():
            continue
        relative=pathlib.PurePosixPath(*parts[2:])
        if not relative.parts:
            continue
        target=(dest/pathlib.Path(*relative.parts)).resolve()
        if dest not in target.parents:
            raise SystemExit('Public asset path escaped its destination.')
        records.append({'websitePath':'/'+str(relative),'localPath':'assets/public/'+str(relative),
                        'archivePath':member.name,'bytes':member.size})
        if not manifest_only:
            target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            src=tar.extractfile(member)
            with src,target.open('xb') as out:
                while True:
                    block=src.read(1024*1024)
                    if not block: break
                    out.write(block)
            target.chmod(0o600)
    print(json.dumps(records))
