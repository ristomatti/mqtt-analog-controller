const config = require('config');
const mqttjs = require('mqtt');
const linearScale = require('simple-linear-scale');
const approxEq = require('approximately-equal');
const { ADCPi } = require('abelectronics');

const { url, clientOptions, topic, status } = config.get('mqtt');
const {
  bitRate,
  analogInputs,
  readInterval,
  publishTolerance,
  scaleMinMax,
  voltageMinMax
} = config.get('adc');
const logging = config.get('logging');

const adc = new ADCPi(0x68, 0x69, bitRate);
const mqtt = mqttjs.connect(url, clientOptions);

const prevValue = {};

console.log('MQTT connecting...');

mqtt.on('connect', () => {
  console.log('MQTT connected');
  mqtt.publish(status.topic, status.payload, status.options);
  setInterval(readInputs, readInterval);
});

function readInputs() {
  if (logging.enabled && logging.reset) {
    resetConsole();
  }

  analogInputs.forEach(input => {
    let voltage = round(adc.readVoltage(input));
    let scale = linearScale(voltageMinMax[input], scaleMinMax, true);
    let scaledValue = Math.round(scale(voltage));

    if (aboveTolerance(input, scaledValue)) {
      mqtt.publish(`${topic}/${input}`, JSON.stringify(scaledValue), {
        qos: 0,
        retain: false
      });
    }
    prevValue[input] = scaledValue;

    if (logging.enabled) {
      console.log(`Input ${input}: ${scaledValue} (${voltage}V)`);
    }
  });
}

function aboveTolerance(input, value) {
  return !approxEq(value, prevValue[input], publishTolerance);
}

function round(voltage) {
  return Math.round(voltage * 1000) / 1000;
}

function resetConsole() {
  process.stdout.write('\033c');
}
