# @grove/shell

Shared layout shell and Nora floating chatbot widget for all Grove apps.

## Usage

Install in any Grove app (peer of Nora):

```json
"dependencies": {
  "@grove/shell": "*"
}
```

### `GroveLayout`

Wraps your app's root layout with a shared nav bar and the Nora floating widget.

```jsx
// app/layout.js (any Grove Next.js app)
import { GroveLayout } from '@grove/shell'
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <GroveLayout
          appName="Shopping List"
          noraUrl={process.env.NEXT_PUBLIC_NORA_URL ?? 'http://localhost:3000'}
        >
          {children}
        </GroveLayout>
      </body>
    </html>
  )
}
```

### `NoraWidget`

Use the widget standalone if you don't want the full shell:

```jsx
import { NoraWidget } from '@grove/shell'

<NoraWidget noraUrl="http://localhost:3000" />
```

## Props

### `GroveLayout`

| Prop       | Type      | Default                   | Description                                  |
|------------|-----------|---------------------------|----------------------------------------------|
| `appName`  | `string`  | `'Grove'`                 | App name shown in the nav bar                |
| `noraUrl`  | `string`  | `'http://localhost:3000'` | Base URL of the Nora app                     |
| `showNora` | `boolean` | `true`                    | Whether to render the floating Nora widget   |
| `children` | `ReactNode` | —                       | Page content                                 |

### `NoraWidget`

| Prop      | Type     | Default                   | Description              |
|-----------|----------|---------------------------|--------------------------|
| `noraUrl` | `string` | `'http://localhost:3000'` | Base URL of the Nora app |

## Architecture

```
apps/
  nora/        — Nora chat app (standalone, no hosting duties)
  shopping-list/ — peer app, imports GroveLayout
  home-ops/    — peer app, imports GroveLayout
packages/
  grove-shell/ — this package: shared nav + NoraWidget
```

The `NoraWidget` renders Nora's `/chat` route inside an iframe drawer. Set `NEXT_PUBLIC_NORA_URL` in each sibling app's `.env` to point at the Nora instance (or leave default for local dev).
