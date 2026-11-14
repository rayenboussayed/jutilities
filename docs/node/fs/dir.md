# `jutilities/node/fs/dir`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/node/fs/dir.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/fs/dir.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/node/fs/dir.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/fs/dir.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { buildTree, copyDirectory, createTempDirectory, directoryFiles, directoryMetadata, directorySize, directoryTree, emptyDirectory, ensureDirectory, isCrossDeviceError, moveDirectory, walkEntries } from "jutilities/node/fs/dir";
import type { DirectoryEntryKind, DirectoryMetadata, DirectoryTree } from "jutilities/node/fs/dir";
```
## Functions

<dl>
<dt><a href="#buildTree">buildTree(root0)</a> ⇒</dt>
<dd><p>Builds the sorted tree for one directory level and its descendants.</p>
</dd>
<dt><a href="#copyDirectory">copyDirectory(root0)</a></dt>
<dd><p>Copies a directory tree, including symlinks as symlinks.</p>
<p>The destination parent is created when missing. Relative symlink targets are
preserved verbatim rather than rewritten to absolute paths. Real copy
failures are thrown.</p>
</dd>
<dt><a href="#createTempDirectory">createTempDirectory(root0)</a> ⇒</dt>
<dd><p>Creates a unique temporary directory.</p>
<p>The parent directory is created when missing.</p>
</dd>
<dt><a href="#directoryFiles">directoryFiles(root0)</a> ⇒</dt>
<dd><p>Lists regular files below a directory, recursively by default.</p>
<p>Symlinks are never followed and are not reported as files. With
<code>recursive: false</code> only immediate children are considered. Read failures are
thrown.</p>
</dd>
<dt><a href="#directoryMetadata">directoryMetadata(root0)</a> ⇒</dt>
<dd><p>Computes aggregate facts about a directory tree.</p>
<p>The root and every descendant are statted, so an explicitly passed symlink
to a directory is accepted and a symlink contributes the size of its target.
Symlinks are never traversed. File and symlink sizes contribute to <code>size</code>;
directory sizes do not. Counts cover descendants only. Read and stat
failures are thrown.</p>
</dd>
<dt><a href="#directorySize">directorySize(root0)</a> ⇒</dt>
<dd><p>Total size of the regular files and symlinks below a directory.</p>
<p>Symlinks contribute their own link length and are never followed. Read and
stat failures are thrown.</p>
</dd>
<dt><a href="#directoryTree">directoryTree(root0)</a> ⇒</dt>
<dd><p>Builds a nested tree of a directory, sorted by name.</p>
<p>The root is accepted even when it is a symlink to a directory; descendants
are never followed through symlinks. Read and stat failures are thrown.</p>
</dd>
<dt><a href="#emptyDirectory">emptyDirectory(root0)</a></dt>
<dd><p>Removes every child of a directory while keeping the directory itself.</p>
<p>The directory is created when missing. Real removal failures are thrown.</p>
</dd>
<dt><a href="#ensureDirectory">ensureDirectory(root0)</a> ⇒</dt>
<dd><p>Creates a directory and any missing parents.</p>
<p>Idempotent: resolves without error when the directory already exists.</p>
</dd>
<dt><a href="#isCrossDeviceError">isCrossDeviceError(error)</a> ⇒</dt>
<dd><p>Detects the <code>EXDEV</code> error raised when a rename crosses filesystems.</p>
</dd>
<dt><a href="#moveDirectory">moveDirectory(root0)</a></dt>
<dd><p>Moves a directory, falling back to copy-and-remove across filesystems.</p>
<p>The destination parent is created when missing. Renames are attempted
first; only <code>EXDEV</code> triggers the copy fallback. Other rename, copy, and
removal failures are thrown.</p>
</dd>
<dt><a href="#walkEntries">walkEntries(root0)</a></dt>
<dd><p>Depth-first walk over the entries below <code>directory</code>.</p>
<p>Entries are visited in name order. Symlinks are yielded but never
traversed, so a link cycle cannot hang the scan. Read failures are thrown.</p>
</dd>
</dl>

<a name="buildTree"></a>

## buildTree(root0) ⇒
Builds the sorted tree for one directory level and its descendants.

**Kind**: global function  
**Returns**: The directory node.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to read. |
| root0.name | Name to give the node. |
| root0.signal | Optional abort signal checked between entries. |


* * *

<a name="copyDirectory"></a>

## copyDirectory(root0)
Copies a directory tree, including symlinks as symlinks.

The destination parent is created when missing. Relative symlink targets are
preserved verbatim rather than rewritten to absolute paths. Real copy
failures are thrown.

**Kind**: global function  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.source | Directory to copy. |
| root0.destination | Destination path. |
| root0.overwrite | Replace an existing destination (default `false`). |


* * *

<a name="createTempDirectory"></a>

## createTempDirectory(root0) ⇒
Creates a unique temporary directory.

The parent directory is created when missing.

**Kind**: global function  
**Returns**: The created directory path.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Parent directory (default `os.tmpdir()`). |
| root0.prefix | Name prefix (default `"jutilities-"`). |


* * *

<a name="directoryFiles"></a>

## directoryFiles(root0) ⇒
Lists regular files below a directory, recursively by default.

Symlinks are never followed and are not reported as files. With
`recursive: false` only immediate children are considered. Read failures are
thrown.

**Kind**: global function  
**Returns**: Sorted regular-file paths, in depth-first order.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to scan. |
| root0.recursive | Recurse into subdirectories (default `true`). |
| root0.signal | Optional abort signal checked between entries. |


* * *

<a name="directoryMetadata"></a>

## directoryMetadata(root0) ⇒
Computes aggregate facts about a directory tree.

The root and every descendant are statted, so an explicitly passed symlink
to a directory is accepted and a symlink contributes the size of its target.
Symlinks are never traversed. File and symlink sizes contribute to `size`;
directory sizes do not. Counts cover descendants only. Read and stat
failures are thrown.

**Kind**: global function  
**Returns**: Metadata, or `undefined` when the root is not a directory.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to inspect. |
| root0.signal | Optional abort signal checked between entries. |


* * *

<a name="directorySize"></a>

## directorySize(root0) ⇒
Total size of the regular files and symlinks below a directory.

Symlinks contribute their own link length and are never followed. Read and
stat failures are thrown.

**Kind**: global function  
**Returns**: Size in bytes, or `undefined` when the root is not a directory.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to measure. |
| root0.signal | Optional abort signal checked between entries. |


* * *

<a name="directoryTree"></a>

## directoryTree(root0) ⇒
Builds a nested tree of a directory, sorted by name.

The root is accepted even when it is a symlink to a directory; descendants
are never followed through symlinks. Read and stat failures are thrown.

**Kind**: global function  
**Returns**: The tree, or `undefined` when the root is not a directory.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to scan. |
| root0.signal | Optional abort signal checked between entries. |


* * *

<a name="emptyDirectory"></a>

## emptyDirectory(root0)
Removes every child of a directory while keeping the directory itself.

The directory is created when missing. Real removal failures are thrown.

**Kind**: global function  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to empty. |


* * *

<a name="ensureDirectory"></a>

## ensureDirectory(root0) ⇒
Creates a directory and any missing parents.

Idempotent: resolves without error when the directory already exists.

**Kind**: global function  
**Returns**: Resolves once the directory exists.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to create. |


* * *

<a name="isCrossDeviceError"></a>

## isCrossDeviceError(error) ⇒
Detects the `EXDEV` error raised when a rename crosses filesystems.

**Kind**: global function  
**Returns**: `true` for an `Error` whose `code` is `"EXDEV"`.  

| Param | Description |
| --- | --- |
| error | The caught value. |


* * *

<a name="moveDirectory"></a>

## moveDirectory(root0)
Moves a directory, falling back to copy-and-remove across filesystems.

The destination parent is created when missing. Renames are attempted
first; only `EXDEV` triggers the copy fallback. Other rename, copy, and
removal failures are thrown.

**Kind**: global function  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.source | Directory to move. |
| root0.destination | Destination path. |


* * *

<a name="walkEntries"></a>

## walkEntries(root0)
Depth-first walk over the entries below `directory`.

Entries are visited in name order. Symlinks are yielded but never
traversed, so a link cycle cannot hang the scan. Read failures are thrown.

**Kind**: global function  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.directory | Directory to scan. |
| root0.signal | Optional abort signal checked between entries. |


* * *


