// Deferred native dialogs for use inside react-aria press handlers.
//
// HeroUI Buttons (and other @heroui/@react-aria components) use `usePress`.
// Opening a blocking native dialog (`window.confirm` / `alert` / `prompt`)
// *synchronously* inside an `onPress` handler interrupts the browser's pointer
// sequence, so react-aria — and `@dnd-kit`'s PointerSensor — can miss the
// pointerup/click and never tear down their global press state. The result is
// that the whole page becomes unclickable (you can focus an input but cannot
// type into it) until a full reload — first seen as a trainer deleting an
// exercise then being unable to edit/add another without refreshing.
//
// Yielding one macrotask before opening the dialog lets the press/pointer
// cycle finish and clean up first, then the dialog opens with no pending
// gesture. Always `await` these from within an `onPress` handler instead of
// calling `window.confirm`/`alert`/`prompt` directly.

/** Like `window.confirm`, but safe to call from a react-aria `onPress`. */
export function confirmAfterPress(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(window.confirm(message)), 0);
  });
}

/** Like `window.alert`, but safe to call from a react-aria `onPress`. */
export function alertAfterPress(message: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      window.alert(message);
      resolve();
    }, 0);
  });
}
