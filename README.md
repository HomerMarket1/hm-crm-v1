# React + Vite

Esta plantilla ofrece una configuración mínima para utilizar React en Vite, incluyendo HMR (Hot Module Replacement) y algunas reglas de ESLint.

Actualmente, existen dos plugins oficiales disponibles:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) utiliza [Oxc](https://oxc.rs) para la funcionalidad «Fast Refresh».
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) utiliza [SWC](https://swc.rs/) para la funcionalidad «Fast Refresh».

## React Compiler

React Compiler no está habilitado en esta plantilla debido a su impacto en el rendimiento durante el desarrollo y la compilación (build). Para añadirlo, consulta [esta documentación](https://react.dev/learn/react-compiler/installation).

## Ampliación de la configuración de ESLint

Si estás desarrollando una aplicación para producción, recomendamos utilizar TypeScript con reglas de linting que tengan en cuenta los tipos (type-aware lint rules). Consulta la [plantilla para TS](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) para obtener información sobre cómo integrar TypeScript y [`typescript-eslint`](https://typescript-eslint.io) en tu proyecto.