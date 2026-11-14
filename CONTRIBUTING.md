# Contributing

Yes, please. Issues and pull requests on this repository are read and answered.

## Check which half you are in first

This package comes from two sources, and which one a file belongs to decides
whether your change survives the next release.

**Generated from the API spec.** Most of this repository is produced by
[OpenAPI Generator](https://openapi-generator.tech) from the published spec at
<https://developers.lockally.com/openapi.yaml>. If the bug is there, it is
almost always a bug in the spec, so the useful fix is upstream, where every
language gets it at once. Open an issue describing the request or response that
is wrong. A patch to a generated file is still welcome as a demonstration of
what the output should be; say so in the pull request and we will move it into
the spec.

**Hand-written.** The authentication and ergonomics layer, the tests beside it, the packaging manifest, and the CI and publish workflows under `.github/`. These files are not generated, and a patch to
them is an ordinary patch: we carry it into the source tree and it ships from
then on.

If you cannot tell which half a file is in, open the issue anyway and say so.
Working that out is our job.

## What happens to a merged pull request

Releases are cut by syncing this repository from Lockally's source tree. That
sync stops when it finds a commit here it did not write, so a merged pull
request holds the next release until somebody has carried it across. It is not
silently overwritten.

## Security

Do not open a public issue for a vulnerability. Mail <security@lockally.com>;
see <https://lockally.com/.well-known/security.txt>.
