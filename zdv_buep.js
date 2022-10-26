const INFO = 0;  // типы сообщений в логе
const ALERT = 1;
const ERROR = 2;

const DELAY_DEBLOCK = 100;  // задержка на открытие/закрытие после деблокировки, мс (на всякий случай)

const mess = [[], null, null];  // 0 - сообщения в журнал (массивом), 1 - команды с задержкой, 2 - команды управления
const MS_LOG = 0;
const MS_DELAY = 1;
const MS_TU = 2;

const tag = context.get('tag');  // nasosn2/Zdv_1/
const topic = msg.topic.startsWith(tag) ? msg.topic.slice(context.get('tagLength')) : msg.topic;  // удаляем путь из топика: nasosn2/Zdv_1/toOpen -> toOpen
const val = msg.payload;

const state = context.get('state');         // текущее состояние задвижки
let knOpen = context.get('knOpen');         // концевик открытия
let knClose = context.get('knClose');       // концевик закрытия

const OPEN = 0;  // константы состояния задвижки
const TO_OPEN = 1;
// const ERROR = 2;  - не дублируем
const CLOSE = 3;
const TO_CLOSE = 4;
const MIDDLE = 5;
const strState = ['Открыта', 'Открывается', 'Авария', 'Закрыта', 'Закрывается', 'В промежутке'];

switch (topic) {
  case 'linkOn':      // наличие связи с модулями ввода-вывода
    if (val) {
      context.set('linkOn', true);
    } else {
      context.set('linkOn', false);
      context.set('state', ERROR);  // устанавливаем статус аварии

      mess[MS_LOG].push({
        payload: {
          str: `Отсутствует связь с задвижкой!`,
          type: ERROR,
        }
      });
    }
    break;

  case 'toOpen':      // команда от скрипта или оператора на Открытие
    mess[MS_LOG].push({
      payload: {
        str: `Подана команда Открыть`,
        type: INFO,
      }
    });
    context.set('fixState', OPEN);  // требуемое состояние задвижки

    if ((state == OPEN) || (state == TO_OPEN)) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка уже открыта/открывается`,
          type: INFO,
        }
      });

    } else if (state == TO_CLOSE) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка сейчас закрывается. Останавливаем задвижку`,
          type: INFO,
        }
      });

      mess[MS_TU] = {
        topic: `${tag}tuClose`,
        payload: false,
      };

      context.set('state', MIDDLE);  // устанавливаем промежуток
      mess[MS_DELAY] = {  // сначала останавливаем, на открытие подаем с задержкой (на отработку остановки)
        topic: `toOpen`,
        payload: true,
        delay: env.get('timeReverse(ms)'),
      };

    } else if ((state == CLOSE) || (state == MIDDLE)) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка ТУ: Открыть`,
          type: INFO,
        }
      });

      mess[MS_TU] = {
        topic: `${tag}tuOpen`,
        payload: true,
      };

      context.set('state', TO_OPEN);  // устанавливаем статус открытия
      mess[MS_DELAY] = {  // обратка на открытие (на отработку открытия)
        topic: `checkOpen`,
        payload: true,
        delay: env.get('timeMove(ms)'),
      };

    } else if (state == ERROR) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка в Аварии не управляется. Необходимо устранить`,
          type: ALERT,
        }
      });
    }
    break;

  case 'checkOpen':   // обратка на отработку открытия
    if (state == TO_OPEN) {  // задвижка не открылась за установленное время
      mess[MS_LOG].push({
        payload: {
          str: `Авария открытия Задвижки!`,
          type: ERROR,
        }
      });

      context.set('state', ERROR);  // устанавливаем статус аварии
      mess[MS_TU] = {                // отключаем реле открытия
        topic: `${tag}tuOpen`,
        payload: false,
      };
    }
    break;

  case 'checkClose':  // обратка на отработку закрытия
    if (state == TO_CLOSE) {  // задвижка не закрылась за установленное время
      mess[MS_LOG].push({
        payload: {
          str: `Авария закрытия Задвижки!`,
          type: ERROR,
        }
      });

      context.set('state', ERROR);  // устанавливаем статус аварии
      mess[MS_TU] = {
        topic: `${tag}tuClose`,
        payload: false,
      };
    }
    break;

  case 'toClose':     // команда от скрипта или оператора на Закрытие
    mess[MS_LOG].push({
      payload: {
        str: `Подана команда Закрыть`,
        type: INFO,
      }
    });
    context.set('fixState', CLOSE);  // требуемое состояние задвижки

    if ((state == CLOSE) || (state == TO_CLOSE)) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка уже закрыта/закрывается`,
          type: INFO,
        }
      });

    } else if (state == TO_OPEN) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка сейчас открывается. Останавливаем задвижку`,
          type: INFO,
        }
      });

      mess[MS_TU] = {
        topic: `${tag}tuOpen`,
        payload: false,
      };

      context.set('state', MIDDLE);  // устанавливаем промежуток
      mess[MS_DELAY] = {  // сначала останавливаем, на закрытие подаем с задержкой (на отработку остановки)
        topic: `toClose`,
        payload: true,
        delay: env.get('timeReverse(ms)'),
      };

    } else if ((state == OPEN) || (state == MIDDLE)) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка ТУ: Закрыть`,
          type: INFO,
        }
      });

      mess[MS_TU] = {
        topic: `${tag}tuClose`,
        payload: true,
      };

      context.set('state', TO_CLOSE);  // устанавливаем статус закрытия
      mess[MS_DELAY] = {  // обратка на закрытие (на отработку закрытия)
        topic: `checkClose`,
        payload: true,
        delay: env.get('timeMove(ms)'),
      };

    } else if (state == ERROR) {
      mess[MS_LOG].push({
        payload: {
          str: `Задвижка в Аварии не управляется. Необходимо устранить`,
          type: ALERT,
        }
      });
    }
    break;

  case 'deblock':     // команда сброса аварии
    mess[MS_LOG].push({
      payload: {
        str: `Подана команда Сброса аварии`,
        type: INFO,
      }
    });

    if (state == ERROR) {
      if (knClose && knOpen) {
        mess[MS_LOG].push({
          payload: {
            str: `Авария Концевиков!`,
            type: ERROR,
          }
        });

      } else if (!context.get('linkOn')) {
        mess[MS_LOG].push({
          payload: {
            str: `Отсутствует связь с задвижкой!`,
            type: ERROR,
          }
        });

      } else {
        if (knClose) {
          mess[MS_LOG].push({
            payload: {
              str: `Авария сброшена. Задвижка Закрыта`,
              type: INFO,
            }
          });
          context.set('state', CLOSE);

        } else if (knOpen) {
          mess[MS_LOG].push({
            payload: {
              str: `Авария сброшена. Задвижка Открыта`,
              type: INFO,
            }
          });
          context.set('state', OPEN);

        } else {
          mess[MS_LOG].push({
            payload: {
              str: `Авария сброшена. Задвижка в Промежутке`,
              type: INFO,
            }
          });
          context.set('state', MIDDLE);
        }

        // если требуемое состояние задвижки отличается от текущего
        if ((context.get('fixState') == OPEN) && !knOpen) {
          mess[MS_DELAY] = {  // подаем на открытие с задержкой
            topic: `toOpen`,
            payload: true,
            delay: DELAY_DEBLOCK,
          };

        } else if ((context.get('fixState') == CLOSE) && !knClose) {
          mess[MS_DELAY] = {
            topic: `toClose`,
            payload: true,
            delay: DELAY_DEBLOCK,
          };
        }
      }

    } else {
      mess[MS_LOG].push({
        payload: {
          str: `По задвижке сейчас нет Аварии!`,
          type: INFO,
        }
      });
    }
    break;

  case 'knOpen':      // изменилось состояние концевика
    knOpen = val;
    context.set('knOpen', val);

    if (state != ERROR) {
      if (knOpen && knClose) {
        mess[MS_LOG].push({
          payload: {
            str: `Авария Концевиков!`,
            type: ERROR,
          }
        });

        mess[MS_TU] = {
          topic: `${tag}tuOpen`,
          payload: false,
        };
        context.set('state', ERROR);

      } else if (knOpen) {
        mess[MS_LOG].push({
          payload: {
            str: `Задвижка Открыта`,
            type: INFO,
          }
        });

        mess[MS_TU] = {
          topic: `${tag}tuOpen`,
          payload: false,
        };
        context.set('state', OPEN);

      } else if (!knOpen && !knClose) {
        mess[MS_LOG].push({
          payload: {
            str: `Задвижка сошла с концевика Открытия`,
            type: INFO,
          }
        });
      }

    } else {  // при аварии на всякий случай тоже отключаем открытие
      mess[MS_TU] = {
        topic: `${tag}tuOpen`,
        payload: false,
      };
    }
    break;

  case 'knClose':     // изменилось состояние концевика
    knClose = val;
    context.set('knClose', val);

    if (state != ERROR) {
      if (knOpen && knClose) {
        mess[MS_LOG].push({
          payload: {
            str: `Авария Концевиков!`,
            type: ERROR,
          }
        });

        mess[MS_TU] = {
          topic: `${tag}tuClose`,
          payload: false,
        };
        context.set('state', ERROR);

      } else if (knClose) {
        mess[MS_LOG].push({
          payload: {
            str: `Задвижка Закрыта`,
            type: INFO,
          }
        });

        mess[MS_TU] = {
          topic: `${tag}tuClose`,
          payload: false,
        };
        context.set('state', CLOSE);

      } else if (!knOpen && !knClose) {
        mess[MS_LOG].push({
          payload: {
            str: `Задвижка сошла с концевика Закрытия`,
            type: INFO,
          }
        });
      }

    } else {
      mess[MS_TU] = {
        topic: `${tag}tuClose`,
        payload: false,
      };
    }
    break;

  case 'log':         // сообщение предназначено для журнала, ничего не делаем
    break;

  default:
    mess[MS_LOG].push({
      payload: {
        str: `Необработанное сообщение: ${topic} - ${val}`,
        type: ALERT,
      }
    });
}

if (context.get('state') != state) {  // статус задвижки изменился
  node.status({
    fill: context.get('linkOn') ? 'green' : 'red',
    shape: 'dot',
    text: `статус: ${strState[context.get('state')]}`,
  });
}

if (mess[MS_LOG].length == 0) { // нет сообщений MQTT для передачи в журнал
  mess[MS_LOG] = null;

} else { // добавляем в сообщения MQTT метку времени и топик (одно и тоже для всех сообщений, добавляем здесь, чтобы не дублировать это везде)
  mess[MS_LOG].forEach(el => {
    el.topic = `${tag}/log`;
    el.payload.time = Date.now();
  });
}

return mess;