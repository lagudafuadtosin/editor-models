// Adds a model, or a new version of one, to models.json and publishes its files as a GitHub release.
// The files are taken from a local folder (for example desktop/models in the editor), checked against the
// original publisher's own fingerprints on Hugging Face, then uploaded.
//
//   node scripts/add-model.mjs <name> <version> <hf-repo> <hf-revision> <local-folder> <licence-file> <file> [file...]
//
// Release assets cannot hold folders: each file is uploaded under its own name (onnx/encoder_model.onnx as
// encoder_model.onnx), so the names in one model must all differ.
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const [name, versionArg, repo, revision, local, licence, ...files] = process.argv.slice(2)
const version = Number(versionArg)
if (!name || !version || !repo || !revision || !local || !licence || !files.length) {
  console.error('usage: node scripts/add-model.mjs <name> <version> <hf-repo> <hf-revision> <local-folder> <licence-file> <file> [file...]')
  process.exit(1)
}
const tag = `${name}-v${version}`
const asset = (f) => basename(f)
if (new Set(files.map(asset)).size !== files.length) throw new Error('two files share a name')

function sha256(path) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(path).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject)
  })
}

// The publisher's own list of files at that revision, with fingerprints for the big ones.
const tree = new Map()
for (const dir of ['', 'onnx']) {
  const res = await fetch(`https://huggingface.co/api/models/${repo}/tree/${revision}${dir ? '/' + dir : ''}`)
  if (dir && res.status === 404) continue // no onnx folder in this model
  if (!res.ok) throw new Error(`tree ${dir}: ${res.status}`)
  for (const e of await res.json()) if (e.type === 'file') tree.set(e.path, e)
}

const entry = { version, folder: repo, release: tag, source: `https://huggingface.co/${repo}/tree/${revision}`, licence: `licences/${name}.txt`, files: {} }
for (const f of files) {
  const path = join(local, f)
  if (!existsSync(path)) throw new Error(`${path} is missing`)
  const t = tree.get(f)
  if (!t) throw new Error(`${f} is not in ${repo} at ${revision}`)
  const size = statSync(path).size
  const sum = await sha256(path)
  if (t.size !== size) throw new Error(`${f}: size ${size}, the publisher has ${t.size}`)
  if (t.lfs && t.lfs.oid !== sum) throw new Error(`${f}: fingerprint does not match the publisher's`)
  entry.files[f] = { asset: asset(f), size, sha256: sum }
  console.log(`  ok ${f}  ${(size / 1e6).toFixed(1)} MB`)
}

writeFileSync(join('licences', `${name}.txt`), readFileSync(licence))
const list = JSON.parse(readFileSync('models.json', 'utf8'))
list.models[name] = entry
writeFileSync('models.json', JSON.stringify(list, null, 2) + '\n')

// The release: every file under its flat name, plus the licence.
const staged = files.map((f) => join(local, f))
execFileSync('gh', ['release', 'create', tag, '--title', tag, '--notes', `${name} version ${version}, from ${entry.source}. Licence: ${entry.licence}.`,
  join('licences', `${name}.txt`), ...staged], { stdio: 'inherit' })
console.log(`published ${tag}; now commit and push models.json and licences/${name}.txt`)
