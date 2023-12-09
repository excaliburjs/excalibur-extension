import { LitElement, html } from "lit";

export class ElementInspector extends LitElement {

    render() {
        html`<div>test lit</div>`
    }
}

customElements.define('simple-greeting', ElementInspector);