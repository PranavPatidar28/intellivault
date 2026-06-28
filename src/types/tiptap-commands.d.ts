/**
 * Module augmentation for optional custom TipTap commands.
 *
 * The color-highlight UI defensively supports a `nodeBackground` extension
 * (guarded at runtime by isExtensionAvailable). That extension is not bundled
 * in this project, so its commands aren't in TipTap's generated Commands type.
 * Declare them here so the guarded call sites type-check; the runtime guard
 * still prevents calling them when the extension is absent.
 */
import "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    nodeBackground: {
      /** Toggle a background color on the current node. */
      toggleNodeBackgroundColor: (color: string) => ReturnType;
      /** Remove the background color from the current node. */
      unsetNodeBackgroundColor: () => ReturnType;
    };
  }
}
