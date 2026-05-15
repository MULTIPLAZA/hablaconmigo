# HablaConmigo

PWA de **comunicacion aumentativa con voz** (AAC / SGD) para ninos. Toca un boton con imagen, escucha la palabra, comunica.

Pensada inicialmente para Mariano, pero generalizable a otros ninos en primera infancia (0-3) que esten construyendo lenguaje.

## Stack

- HTML + CSS + JS vanilla (sin frameworks)
- IndexedDB para datos y blobs de imagen
- Web Speech API (`speechSynthesis`) para TTS en espanol
- Service Worker para uso 100% offline despues de primera carga
- PWA instalable (manifest + iconos)

## Ejecutar local

```bash
cd Documents/GitHub/hablaconmigo
node server.js
```

Abrir en navegador: `http://localhost:8030`

## Como funciona

### Modo Mariano (uso del nino)
- Pantalla completa con grilla de botones (imagen + palabra).
- Toque -> dice la palabra en voz alta.
- Sin botones de salida visibles.

### Modo Edicion (padre / cuidador)
- Se accede haciendo **tap largo de 5 segundos en la esquina superior izquierda** + ingresando el **PIN**.
- PIN por defecto: `1234` (cambiar despues de la primera entrada).
- Permite:
  - Crear / editar / eliminar botones
  - Foto desde galeria o camara
  - Cambiar nivel, columnas, voz, velocidad
  - Exportar / importar configuracion en JSON (para sincronizar entre dispositivos)

## Modo kiosco en Android

Para que Mariano no pueda salir de la app:

1. Instalar la PWA (Chrome -> menu -> "Agregar a pantalla de inicio").
2. Abrir la PWA instalada.
3. En Android: deslizar arriba en el centro para ver apps recientes -> tocar el icono de HablaConmigo en la tarjeta -> "Fijar pantalla".
4. Listo: solo se sale con el gesto que vos elegis (Atras + Recientes manteniendo) o desbloqueando el dispositivo.

## Niveles (escala con la edad del nino)

| Nivel | Cuando | Que muestra |
|---|---|---|
| 1 | Arranque (0-3) | 4-6 botones, grilla 2x2 o 2x3, foto enorme + palabra. Sin categorias. |
| 2 | Crecimiento | 9-12 botones, grilla 3x3 o 3x4. Plano. |
| 3 | Categorias (futuro) | Pestanas por color (Comer / Personas / Acciones / Lugares). |
| 4 | Frases (futuro) | Barra superior que acumula toques y reproduce oraciones. |

V1 implementa Nivel 1 y Nivel 2 (cambio de columnas). Niveles 3 y 4 estan en roadmap.

## Lenguaje de nucleo

A medida que Mariano avance, se va a sumar lenguaje de nucleo (`yo`, `vos`, `querer`, `mas`, `no`, `terminado`, etc.) ademas de sustantivos. La fonoaudiologa debe guiar que palabras agregar y en que orden.

## Datos: privacidad

- **100% local**. Nada sale del dispositivo.
- IndexedDB en el navegador.
- Para llevar la misma configuracion a otro celular, usar **Exportar JSON** y compartirlo (WhatsApp, email, Drive) e **Importar** en el otro dispositivo.

## Roadmap

- [ ] Barra de oracion (apilar botones y reproducir frase completa)
- [ ] Categorias con pestanas
- [ ] Grabar audio personalizado (voz de la mama / papa) en vez de TTS
- [ ] Sync entre dispositivos via Supabase (opcional)
- [ ] Estadisticas de uso (botones mas tocados)
- [ ] Empaquetado como APK con Capacitor (modo kiosco "Device Owner")
