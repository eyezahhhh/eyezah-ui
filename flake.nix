{
  description = "My Awesome Desktop Shell";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";

    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { self
    , nixpkgs
    , ags
    , ...
    }:
    let
      pname = "eyezah-ui";

      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];

      forEachSystem = f:
        nixpkgs.lib.genAttrs systems (system:
          f system nixpkgs.legacyPackages.${system}
        );
    in
    {
      ############################################################
      # Configurable builder function
      ############################################################

      lib = {
        mkEyezahUI = system: { instanceId ? "eyezah-ui"
                             , homeDirectory ? "/home/eyezah"
                             , enableShell ? true
                             , enableGreeter ? false
                             , sessionsDir ? "/usr/share/wayland-sessions"
                             , enabledMonitors ? null
                             , disabledMonitors ? null
                             , scale ? null
                             , wallpaperDir ? null
                             , qemuConnectionUrl ? null
                             }:
          let
            pkgs = nixpkgs.legacyPackages.${system};

            astalPackages = with ags.packages.${system}; [
              io
              astal4
              apps
              auth
              battery
              bluetooth
              cava
              greet
              hyprland
              mpris
              network
              notifd
              powerprofiles
              tray
              wireplumber
            ];

            extraPackages =
              astalPackages ++ [
                pkgs.libadwaita
                pkgs.libsoup_3
                pkgs.glib-networking
                pkgs.accountsservice
                pkgs.papirus-icon-theme
                pkgs.libmanette
                pkgs.libgudev
                pkgs.libvirt-glib
              ];
          in
          pkgs.buildNpmPackage {
            name = pname;
            src = ./.;
            dontNpmBuild = true;
            dontWrapQtApps = true;
            npmDepsHash = "sha256-rIDGh0yGbT23hHw7EAKo6PPjW8A+QpOT11WBnGMC0qg=";

            nativeBuildInputs = [
              pkgs.wrapGAppsHook4
              pkgs.gobject-introspection
              ags.packages.${system}.default
              pkgs.jq
              pkgs.makeWrapper
            ];

            buildInputs = extraPackages ++ [
              pkgs.gjs
              pkgs.nodejs_24
              pkgs.wlr-randr
              pkgs.imagemagick
            ];

            postPatch = ''
              ${pkgs.lib.getExe pkgs.jq} \
                'del(.dependencies.ags, .dependencies.gnim, .devDependencies.ags, .devDependencies.gnim)' \
                package.json > package.json.tmp && mv package.json.tmp package.json

              ${pkgs.lib.getExe pkgs.jq} \
                'del(.packages."".dependencies.ags,
                     .packages."".dependencies.gnim,
                     .packages."node_modules/ags",
                     .packages."node_modules/gnim")' \
                package-lock.json > package-lock.json.tmp && mv package-lock.json.tmp package-lock.json
            '';

            installPhase = ''
              runHook preInstall

              export HOME="${homeDirectory}"

              node script/generate-wallust-file.js --dummy
              node script/generate-styles.js --output-file "/dev/null"
              node script/generate-wallust-file.js --instance "${instanceId}"

              mkdir -p $out/bin
              mkdir -p $out/share
              cp -r * $out/share
            ''
            + pkgs.lib.optionalString enableShell ''
              echo "Bundling shell..."

              ags bundle main.app.ts \
                $out/bin/${pname}-shell \
                --root . \
                --gtk 4 \
                -d "SRC='$out/share'" \
                -d "INSTANCE_ID='${instanceId}'" \
                ${pkgs.lib.optionalString (wallpaperDir != null) "-d \"WALLPAPER_DIR='${wallpaperDir}'\""} \
                ${pkgs.lib.optionalString (qemuConnectionUrl != null) "-d \"QEMU_STRING='${qemuConnectionUrl}'\""}
            ''
            + pkgs.lib.optionalString enableGreeter ''
              echo "Bundling greeter..."

              ags bundle greeter.app.ts \
                $out/bin/${pname}-greeter \
                --root . \
                --gtk 4 \
                -d "SRC='$out/share'" \
                -d "INSTANCE_ID='${instanceId}'" \
                -d "SESSIONS_DIR='${sessionsDir}'" \
                ${pkgs.lib.optionalString (enabledMonitors != null && enabledMonitors != [] ) "-d \"ENABLED_MONITORS='${builtins.concatStringsSep ":" enabledMonitors}'\""} \
                ${pkgs.lib.optionalString (disabledMonitors != null && disabledMonitors != [] ) "-d \"DISABLED_MONITORS='${builtins.concatStringsSep ":" disabledMonitors}'\""} \
                ${pkgs.lib.optionalString (scale != null) "-d \"SCALE='${toString scale}'\""} \
                ${pkgs.lib.optionalString (wallpaperDir != null) "-d \"WALLPAPER_DIR='${wallpaperDir}'\""}
            ''
            + ''
              runHook postInstall
            '';

            postFixup = ''
              for bin in $out/bin/*; do
                wrapProgram "$bin" \
                  --prefix PATH : ${pkgs.lib.makeBinPath [
                    pkgs.nodejs_24
                    pkgs.wlr-randr
                    pkgs.imagemagick
                  ]} \
                  --prefix XDG_DATA_DIRS : ${pkgs.papirus-icon-theme}/share
              done
            '';
          };
      };

      ############################################################
      # Default package (flake-valid derivation)
      ############################################################

      packages = forEachSystem (system: pkgs: {
        default = self.lib.mkEyezahUI system { };
      });

      ############################################################
      # Dev shell
      ############################################################

      devShells = forEachSystem (system: pkgs:
        let
          astalPackages = with ags.packages.${system}; [
            io
            astal4
            apps
            auth
            battery
            bluetooth
            cava
            greet
            hyprland
            mpris
            network
            notifd
            powerprofiles
            tray
            wireplumber
          ];

          extraPackages =
            astalPackages ++ [
              pkgs.libadwaita
              pkgs.libsoup_3
              pkgs.glib-networking
              pkgs.nodejs_24
              pkgs.accountsservice
              pkgs.libmanette
              pkgs.libgudev
              pkgs.libvirt-glib
            ];
        in
        {
          default = pkgs.mkShell {
            nativeBuildInputs = [
              pkgs.nodejs_24
            ];

            buildInputs = [
              (ags.packages.${system}.default.override {
                inherit extraPackages;
              })
              pkgs.papirus-icon-theme
            ];
          };
        }
      );

      ############################################################
      # Home Manager module
      ############################################################

      homeManagerModules.default = { config, lib, pkgs, ... }:
        let
          cfg = config.programs.eyezah-ui;
        in
        {
          options.programs.eyezah-ui = {
            wallpaperDir = lib.mkOption {
              type = lib.types.nullOr (lib.types.oneOf [ lib.types.str lib.types.path ]);
              default = null;
              description = ''
                Path to wallpaper directory. Can be:
                  - a relative path in the flake (e.g., ./wallpaper)
                  - an absolute path (e.g., /home/eyezah/.wallpapers)
              '';
            };

            shell = {
              enable = lib.mkEnableOption "Eyezah UI desktop shell";

              qemuConnectionUrl = lib.mkOption {
                type = lib.types.str;
                default = "qemu:///system";
                description = "QEMU connection string used to manage virtual machines.";
              };
            };

            greeter = {
              enable = lib.mkEnableOption "Eyezah UI greeter";

              sessionsDir = lib.mkOption {
                type = lib.types.nullOr lib.types.str;
                default = null;
                description = "Directory containing available login sessions.";
              };

              enabledMonitors = lib.mkOption {
                type = lib.types.listOf lib.types.str;
                default = [ ];
                description = "List of monitors the greeter should enable.";
              };

              disabledMonitors = lib.mkOption {
                type = lib.types.listOf lib.types.str;
                default = [ ];
                description = "List of monitors the greeter should disable.";
              };

              scale = lib.mkOption {
                type = lib.types.nullOr lib.types.float;
                default = null;
                description = "Optional UI scale factor for the greeter.";
              };
            };

            instanceId = lib.mkOption {
              type = lib.types.str;
              default = "eyezah-ui";
              description = "Astal instance ID used during build.";
            };

            package = lib.mkOption {
              type = lib.types.package;
              default =
                self.lib.mkEyezahUI pkgs.system {
                  instanceId = cfg.instanceId;
                  homeDirectory = config.home.homeDirectory;
                  enableShell = cfg.shell.enable;
                  enableGreeter = cfg.greeter.enable;
                  sessionsDir = cfg.greeter.sessionsDir;
                  enabledMonitors = cfg.greeter.enabledMonitors;
                  disabledMonitors = cfg.greeter.disabledMonitors;
                  scale = cfg.greeter.scale;
                  wallpaperDir = cfg.wallpaperDir;
                  qemuConnectionUrl = cfg.shell.qemuConnectionUrl;
                };
              description = "Final eyezah-ui package derivation.";
            };
          };

          config = lib.mkIf (cfg.shell.enable || cfg.greeter.enable) {
            assertions = [
              {
                assertion =
                  !(cfg.greeter.enable) || (cfg.greeter.sessionsDir != null);

                message =
                  "programs.eyezah-ui.greeter.sessionsDir must be set when greeter.enable = true.";
              }
            ];

            home.packages = [ cfg.package ];
          };
        };
    };
}
