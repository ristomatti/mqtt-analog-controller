const config = require('config');
const mqttjs = require('mqtt');
const linearScale = require('simple-linear-scale');
const approxEq = require('approximately-equal');
const { ADCPi } = require('abelectronics');

const analogInputs = [1, 2, 3, 4, 5, 6, 7, 8];
const interval = 1000; // milliseconds
const tolerance = .01; // tolerance for voltage floating

const maxVoltages = {
  '1': 5,
  '2': 5,
  '3': 5,
  '4': 5,
  '5': 5,
  '6': 5,
  '7': 5,
  '8': 5
};

const mqttConfig = config.get('mqtt');
const { topic } = mqttConfig;

const adc = new ADCPi(0x68, 0x69, 16);
const mqtt = mqttjs.connect(mqttConfig.url, mqttConfig.options);

const prevVoltage = {};

mqtt.on('connect', () => {
  mqtt.publish(topic.status, 'online', {
    qos: 1,
    retain: true
  });

  setInterval(readInputs, interval);
  readInputs();
});

function readInputs() {
  resetConsole();

  analogInputs.forEach(input => {
    let voltage = round(adc.readVoltage(input));
    let maxVoltage = maxVoltages[input];
    let toPercentage = linearScale([0, maxVoltage], [0, 100], true);
    let value = Math.round(toPercentage(voltage));

    console.log(`Input ${input}: ${value}% (${voltage}V)`);

    if (aboveTolerance(input, voltage)) {
      mqtt.publish(`${topic.root}/${input}`, JSON.stringify(value), {
        qos: 0,
        retain: false
      });
    }
    prevVoltage[input] = voltage;
  });
}

function aboveTolerance(input, voltage) {
  return !approxEq(voltage, prevVoltage[input], tolerance);
}

function round(voltage) {
  return Math.round(voltage * 1000) / 1000;
}

function resetConsole() {
  process.stdout.write('\033c');
}
