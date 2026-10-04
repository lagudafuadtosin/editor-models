# Postbarrel Vid Editor: models

The AI models the Postbarrel Vid Editor downloads when a feature needs one (captions, cut-outs, erase, upscale, clean voice). Everything runs on your own computer. Your videos, photos and sound are never sent anywhere.

## How it works

`models.json` lists every model by name with its version, file, size and SHA-256 fingerprint. The app reads it, downloads only what is missing or older than the listed version, checks the fingerprint, and keeps the file on your PC. The old copy is kept until the new one is checked.

Each model's files are attached to a release named after it, for example `captions-en-v1`.

## Licences

Every model here is published by others under a licence that allows it to be shared and used commercially. Each release carries that model's licence file, and `licences/` holds a copy of each one.
