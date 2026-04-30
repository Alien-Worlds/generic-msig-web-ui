# Windows Code Signing

Windows shows "Unknown publisher" and SmartScreen warnings for unsigned executables. Code signing removes these and makes the app trusted.

## What You Need

1. **Code signing certificate** (from DigiCert, Sectigo, GlobalSign, etc.)
   - **EV certificate** – Immediate trust, no SmartScreen. Requires USB dongle; best for organizations.
   - **Standard certificate** – Lower cost. SmartScreen may warn until enough users install and trust builds.

2. **Certificate file** – Export your certificate as `.pfx` or `.p12` (includes private key).

## Setup

Set these environment variables before building (never commit them):

```bash
# Path to your .pfx or .p12 file (or base64-encoded cert data)
export CSC_LINK=path/to/your-certificate.pfx

# Password to decrypt the certificate
export CSC_KEY_PASSWORD=your-cert-password
```

Then build:

```bash
yarn build:win
```

electron-builder will sign the exe and installer automatically when `CSC_LINK` and `CSC_KEY_PASSWORD` are set.

## EV Certificate (USB Dongle)

If using an EV certificate installed in the Windows certificate store:

1. Add to `package.json` under `build.win`:

```json
"certificateSubjectName": "Your Company Name"
```

2. Build on Windows with the USB dongle connected. electron-builder will use the cert from the store.

## CI/CD

- Store `CSC_LINK` as base64: `echo -n "$(cat cert.pfx | base64)"` and set that as the env var.
- Store `CSC_KEY_PASSWORD` as a secret in your CI (GitHub Actions secrets, etc.).

## References

- [electron-builder Windows signing](https://www.electron.build/code-signing-win.html)
