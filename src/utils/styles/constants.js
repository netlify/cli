import isUnicodeSupported from 'is-unicode-supported';
const unicode = isUnicodeSupported();
const symbolCharacter = (defaultCharacter, fallbackCharacter) => unicode ? defaultCharacter : fallbackCharacter;
const STEP_ACTIVE = symbolCharacter('◆', '*');
const STEP_CANCEL = symbolCharacter('■', 'x');
const STEP_ERROR = symbolCharacter('▲', 'x');
const STEP_SUBMIT = symbolCharacter('◇', 'o');
const BAR_START = symbolCharacter('┌', 'T');
const BAR = symbolCharacter('│', '|');
const BAR_END = symbolCharacter('└', '—');
const RADIO_ACTIVE = symbolCharacter('●', '>');
const RADIO_INACTIVE = symbolCharacter('○', ' ');
const CHECKBOX_ACTIVE = symbolCharacter('◻', '[•]');
const CHECKBOX_SELECTED = symbolCharacter('◼', '[+]');
const CHECKBOX_INACTIVE = symbolCharacter('◻', '[ ]');
const PASSWORD_MASK = symbolCharacter('▪', '•');
const BAR_H = symbolCharacter('─', '-');
const CORNER_TOP_RIGHT = symbolCharacter('╮', '+');
const CONNECT_LEFT = symbolCharacter('├', '+');
const CORNER_BOTTOM_RIGHT = symbolCharacter('╯', '+');
const INFO = symbolCharacter('●', '•');
const SUCCESS = symbolCharacter('◆', '*');
const WARN = symbolCharacter('▲', '!');
const ERROR = symbolCharacter('■', 'x');
export const symbols = {
    STEP_ACTIVE,
    STEP_CANCEL,
    STEP_ERROR,
    STEP_SUBMIT,
    BAR_START,
    BAR,
    BAR_END,
    RADIO_ACTIVE,
    RADIO_INACTIVE,
    CHECKBOX_ACTIVE,
    CHECKBOX_SELECTED,
    CHECKBOX_INACTIVE,
    PASSWORD_MASK,
    BAR_H,
    CORNER_TOP_RIGHT,
    CONNECT_LEFT,
    CORNER_BOTTOM_RIGHT,
    INFO,
    SUCCESS,
    WARN,
    ERROR,
};
