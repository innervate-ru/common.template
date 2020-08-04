import {VType, validateOptionsFactory, validateThisServiceSettings} from './common/validation'

export const ctor_settings = validateThisServiceSettings({
  _final: false,
});

export const httpConfigSchema = validateOptionsFactory({
  port: {required: true, type: VType.Int().positive()},
});
