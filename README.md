# ⚡ Guía Interactiva: Fetch API & Dragon Ball

Guía didáctica para practicar el consumo de servicios web con JavaScript y `fetch()`. El catálogo usa Dragon Ball API para consultar personajes, sus imágenes, razas, afiliaciones, planetas de origen y transformaciones.

## Estructura del proyecto

```text
ConsumoAPI/
├── index.html       # Portal de personajes, galería y guía Fetch
├── css/
│   ├── base.css       # Tipografía, colores y estructura base
│   ├── components.css # Componentes del laboratorio y guía
│   ├── dragonball.css # Catálogo y detalles de personajes
│   ├── views.css      # Estilos de las vistas del portal
│   ├── scene.css      # Escena animada inspirada en Kame House y galería
│   ├── theme.css      # Identidad visual compartida y navegación
│   ├── catalog.css    # Filtros, tarjetas y ficha de personajes
│   ├── gallery.css    # Galería de retratos
│   ├── lab-guide.css  # Laboratorio Fetch y guía
│   ├── lightbox.css   # Visor de imágenes con perspectiva
│   └── responsive.css # Ajustes para móvil y movimiento reducido
├── js/
│   └── app.js         # Consumo de API, vistas, filtros y renderizado
└── README.md        # Documentación del proyecto
```

## Características

1. **Vistas separadas:** Inicio, Personajes, Galería, Laboratorio y Guía Fetch tienen navegación propia.
2. **Catálogo interactivo:** consulta personajes, filtra por raza o afiliación y navega por páginas.
3. **Ficha detallada:** muestra descripción y planeta de origen; permite elegir una transformación y ampliar su retrato.
4. **Visor con profundidad:** al pulsar un retrato se abre una ventana grande con inclinación 3D simulada, brillo y respuesta al cursor. En el visor, haz clic sobre cualquier zona del personaje para ampliarla; la API entrega imágenes 2D, así que no se requiere un modelo 3D.
5. **Escena animada:** el inicio se inspira en la costa de Kame House con nubes, esferas del dragón, aura y un personaje del catálogo.
6. **Dos patrones de Fetch:** ejecuta peticiones con `async/await` o con promesas (`.then()` / `.catch()`).
7. **Métricas HTTP:** muestra estado de respuesta, latencia y tipo de contenido.
8. **Inspector:** alterna entre el JSON recibido y el código de la petición.
9. **Interfaz en español:** las razas, afiliaciones y géneros de la API se muestran traducidos; los filtros envían a la API sus valores originales.
10. **Diseño adaptable:** el portal usa un ancho fluido y reorganiza vistas, filtros, tarjetas, métricas y visor para móvil, tableta, escritorio y distintos niveles de zoom.

## Ejecutar el proyecto

Desde esta carpeta, inicia un servidor local:

```bash
python3 -m http.server 8000
```

Abre <http://localhost:8000>. La aplicación necesita internet para consultar la API y cargar las imágenes.

## Ejemplos de Fetch

### Con `async / await`

```js
async function obtenerPersonajes() {
  const url = 'https://dragonball-api.com/api/characters?limit=12';

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`Error HTTP: ${respuesta.status}`);

    const datos = await respuesta.json();
    console.log(datos.items);
  } catch (error) {
    console.error('Error al consultar personajes:', error.message);
  }
}
```

### Con promesas (`.then() / .catch()`)

```js
function obtenerPersonajesConPromesas() {
  fetch('https://dragonball-api.com/api/characters?limit=12')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error(`Error HTTP: ${respuesta.status}`);
      return respuesta.json();
    })
    .then((datos) => console.log(datos.items))
    .catch((error) => console.error('Error:', error.message));
}
```

La aplicación consume los endpoints de [personajes y fichas](https://web.dragonball-api.com/documentation) de Dragon Ball API.

---

*© 2026 — Diseño de Sistemas de Internet | Universidad Nacional de Ingeniería*
