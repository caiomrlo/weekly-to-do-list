# Builders

URL: /docs/builders

Source: https://github.com/easypanel-io/monorepo/blob/main/apps/website/content/docs/builders.mdx

Choose and configure how Easypanel turns application source into a container image.



An App service needs a container image before it can run. When the source is an
upload, GitHub repository, or Git repository, Easypanel can build that image
with Dockerfile, Cloud Native Buildpacks, Nixpacks, or Railpack.

The builder runs against the source's configured **Build Path**. In a monorepo,
set that path to the application directory so detection files, package
manifests, and the Docker build context come from the intended project.

## Choose a builder [#choose-a-builder]

| Builder    | Good choice when                                                      | Configuration                                                                        |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Railpack   | You want modern automatic detection with focused overrides            | Commands, Mise packages, build APT packages, deploy APT packages, or `railpack.json` |
| Dockerfile | You need complete control over the image and build stages             | A repository Dockerfile or Easypanel's inline Dockerfile source                      |
| Buildpacks | Your application follows a supported Cloud Native Buildpacks workflow | Builder image, build-time environment, and optional `project.toml`                   |
| Nixpacks   | An existing application depends on its Nix-based build plan           | Commands, Nix packages, APT packages, or `nixpacks.toml`                             |

For a new application without a Dockerfile, start with **Railpack**. Use a
Dockerfile when automatic detection cannot express the required build or when
you need full control over the base image and system configuration.

<Callout type="info">
  Easypanel currently selects Dockerfile automatically when the Build Path
  contains a file named `Dockerfile`. Otherwise, an App service without saved
  build settings falls back to Nixpacks. Select Railpack explicitly when you
  want to use it.
</Callout>

## Configure and run a build [#configure-and-run-a-build]

1. Open the App service's **Source** section.
2. Select **Upload**, **GitHub**, or **Git** and configure its **Build Path**.
3. Open **Build** and select a builder.
4. Save its settings.
5. Select **Deploy** from the service overview.
6. Open the deployment action to review detection, dependency installation,
   compilation, and image creation output.

Saving a builder does not deploy the application. Use **Force Rebuild** when
you need another deployment without the existing Docker build cache.

Project and service environment variables are available during builds, and
Easypanel also adds `GIT_SHA` for repository deployments. They are provided to
the running container separately.

## Railpack [#railpack]

[Railpack](https://railpack.com/) analyzes the source, selects a provider,
creates a build plan, and produces an image with BuildKit. It supports common
Node.js and frontend frameworks as well as Python, Go, PHP, Java, Ruby, .NET,
Deno, Rust, Elixir, static sites, and other providers.

Railpack is the preferred automatic builder for new applications. It is the
successor to Nixpacks and generally produces smaller runtime images with more
granular build and runtime package controls.

### Easypanel settings [#easypanel-settings]

* **Version** pins the Railpack release used to generate and execute the plan.
* **Install Command** replaces the provider's detected install commands.
* **Build Command** replaces the provider's detected build commands.
* **Start Command** sets the command used when the resulting container starts.
* **Mise Packages** installs additional tools. Enter space-separated
  `package@version` values; the version is optional.
* **Build APT Packages** installs packages needed only while building.
* **Deploy APT Packages** installs packages in the final runtime image.

Use **Deploy APT Packages** for commands the application needs after it starts,
such as `ffmpeg`. Prefer **Build APT Packages** for compilers and headers that
are not needed at runtime.

The three command fields are replacements, not additional commands. Leave them
empty to use Railpack's detected provider commands.

### Advanced Railpack configuration [#advanced-railpack-configuration]

For configuration beyond the Easypanel fields, add `railpack.json` to the root
of the Build Path. Railpack automatically reads that file. It can select a
provider, add or change build steps, configure caches and packages, and control
the final deployment command.

```json
{
  "$schema": "https://schema.railpack.com",
  "provider": "node",
  "steps": {
    "build": {
      "commands": ["npm run build"]
    }
  },
  "deploy": {
    "startCommand": "node dist/server.js"
  }
}
```

See the official [Railpack configuration
reference](https://railpack.com/config/file/) and [environment variable
reference](https://railpack.com/config/environment-variables/).

<Callout type="info">
  Easypanel supplies project and service environment values to Railpack as
  BuildKit secrets during the build. Keep secrets out of commands and logs, and
  do not copy them into generated application artifacts.
</Callout>

## Dockerfile [#dockerfile]

Dockerfile builds provide direct control over the build stages, base image,
installed packages, files, user, and default command.

There are two ways to use one:

* With an Upload, GitHub, or Git source, select **Dockerfile** under **Build**
  and enter the file path. The default is `Dockerfile`.
* Select **Dockerfile** as the source type to store a complete inline
  Dockerfile in Easypanel. This source has no repository files unless the
  Dockerfile downloads or creates them itself.

For repository sources, the Dockerfile path is resolved from the Build Path,
and that directory is also the Docker build context. A Dockerfile cannot `COPY`
files outside that context.

Easypanel builds the image with Docker Buildx and passes project and service
environment values, including `GIT_SHA`, as build arguments. Declare only the
arguments the Dockerfile needs:

```dockerfile
ARG GIT_SHA
RUN echo "Building revision ${GIT_SHA}"
```

<Callout type="warn">
  Docker build arguments are not a secure secret mechanism. A value can be
  exposed by a command, image metadata, or a build layer. Avoid using sensitive
  environment variables in Dockerfile instructions; use a secret-aware build
  pattern instead.
</Callout>

Use a multi-stage Dockerfile to leave compilers and source-only dependencies
out of the final image. Pin important base-image versions or digests and keep a
`.dockerignore` file in the Build Path to exclude local dependencies, Git data,
secrets, and other unnecessary files.

See Docker's [Dockerfile
reference](https://docs.docker.com/reference/dockerfile/) for instruction
syntax.

## Buildpacks [#buildpacks]

Easypanel uses the `pack` CLI and a selected [Cloud Native Buildpacks
builder](https://buildpacks.io/docs/for-app-developers/concepts/builder/) to
detect the application, install its runtime and dependencies, and create an
OCI image without a Dockerfile.

The current builder suggestions include:

* `heroku/builder:24`, the default;
* `heroku/builder:22` and `heroku/builder:20`;
* Paketo Jammy full, base, and tiny builders.

The **Builder** field accepts an image reference, so it is not limited to the
suggestions. A builder controls which buildpacks, build image, and run images
are available. Test compatibility before changing it on an existing service.

Easypanel asks `pack` to use the `web` process as the image's default process.
Make sure the detected buildpacks create that process. Use a `project.toml`
file in the Build Path when you need to select buildpacks or configure other
Cloud Native Buildpacks inputs.

See the official [Cloud Native Buildpacks app developer
guide](https://buildpacks.io/docs/for-app-developers/) and the current [Heroku
Cloud Native Buildpacks
documentation](https://devcenter.heroku.com/articles/managing-buildpacks).

<Callout type="info">
  The old Easypanel documentation described Heroku Buildpacks and Paketo
  Buildpacks as separate modes. The current interface exposes one Buildpacks
  mode; the selected builder image determines which buildpacks and stack are
  used.
</Callout>

## Nixpacks [#nixpacks]

[Nixpacks](https://nixpacks.com/) detects the application and produces a
Nix-based build plan containing packages, install and build commands, and a
start command.

Nixpacks is now in maintenance mode, and its maintainers recommend Railpack as
the replacement. Existing Nixpacks services can continue to use it, but prefer
Railpack for new applications unless a project depends on Nix-specific
packages or behavior.

### Easypanel settings [#easypanel-settings-1]

* **Version** pins the Nixpacks release.
* **Install Command**, **Build Command**, and **Start Command** replace detected
  commands.
* **Nix Packages** adds packages from Nix.
* **APT Packages** adds packages through APT.

Pin the version for repeatable builds. Test a version change in a staging
service because provider detection and generated build plans can change between
releases.

For more control, put `nixpacks.toml` or `nixpacks.json` in the Build Path. The
file can extend provider-generated phases instead of replacing every detected
setting.

See the official [Nixpacks configuration
guide](https://nixpacks.com/docs/guides/configuring-builds).

## Build paths and monorepos [#build-paths-and-monorepos]

Detection and build files must be inside the configured Build Path:

```text
repository/
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   └── railpack.json
│   └── web/
└── package.json
```

For the API in this example, use `/apps/api` when it can build independently.
Use `/` when its build needs workspace files from the repository root.

The Build Path is also the boundary of the Docker build context. Choosing a
deep path can prevent access to shared packages above it; choosing the
repository root can make automatic detection select the wrong application.

## Docker Buildx builders [#docker-buildx-builders]

Dockerfile and generated Nixpacks and Railpack images use the currently
selected Docker Buildx builder. Open **Settings → Server → Docker Builders** to:

* see the current builder and whether its node is running;
* create and select a builder with CPU, memory, and swap limits;
* switch, stop, or remove non-default builders.

A resource-limited builder can protect application workloads from build spikes,
but a limit that is too low can terminate dependency installation or
compilation. For another server, see [Remote Docker
Builder](/docs/guides/remote-docker-builder).

## Troubleshooting [#troubleshooting]

### The builder detects the wrong application [#the-builder-detects-the-wrong-application]

Check the Source **Build Path** and make sure the expected manifest or config
file is at its root. In a monorepo, decide whether the application can build
from its own directory or needs the repository root.

### The build succeeds but the container does not start [#the-build-succeeds-but-the-container-does-not-start]

Check the detected or overridden start command. The application should run as
a foreground process, listen on the configured target port, and normally bind
to `0.0.0.0`.

### A command or library is missing at runtime [#a-command-or-library-is-missing-at-runtime]

With Railpack, put runtime commands in **Deploy APT Packages**, not only **Build
APT Packages**. With a Dockerfile, install runtime dependencies in the final
stage. For Nixpacks or Buildpacks, inspect the generated plan or builder
documentation.

### A corrected build keeps using old output [#a-corrected-build-keeps-using-old-output]

Select **Force Rebuild** to bypass the Docker build cache. If the issue remains,
check package-manager caches, generated artifacts committed to the repository,
and whether the deployment is building the expected revision and Build Path.

### The build runs out of memory [#the-build-runs-out-of-memory]

Review server capacity and the selected Docker builder's limits. Increase the
builder memory or swap, reduce parallel compilation, or use a remote builder.
