/**
 * Runs synchronously during HTML parsing, before first paint, so the saved
 * theme applies with no flash. Recipe from
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 * ("Themes"). Paired with the `useLayoutEffect` re-apply in ThemeToggle for
 * React Strict Mode's dev remount, which otherwise strips this attribute.
 */
export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          '(function(){try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()',
      }}
    />
  );
}
