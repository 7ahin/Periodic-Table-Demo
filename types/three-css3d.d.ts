declare module 'three/examples/jsm/renderers/CSS3DRenderer.js' {
  import { Object3D, Scene, Camera } from 'three'

  export class CSS3DRenderer {
    domElement: HTMLDivElement
    setSize(width: number, height: number): void
    render(scene: Scene, camera: Camera): void
  }

  export class CSS3DObject extends Object3D {
    constructor(element: HTMLElement)
  }
}
