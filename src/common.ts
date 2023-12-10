import { css } from "lit";

export const common = css`
.section {
    position: relative;
    padding: 10px;
    background-color: var(--panel-color);
    margin-bottom: 10px;
}

.section::before {
    content: '';
    position: absolute;
    left: -5px;
    top: 0;
    height: 100%;
    border-left: 5px solid var(--red-accent);
}

.form-row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
}

.form-row>*:not(:last-child) {
    margin-right: 5px;
}

.form-row>*:last-child {

    margin-left: auto;
}
`