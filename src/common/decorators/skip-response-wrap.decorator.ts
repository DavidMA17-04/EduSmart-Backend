import { SetMetadata } from '@nestjs/common';
import { SKIP_RESPONSE_WRAP_KEY } from '../constants/metadata.constant';

export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP_KEY, true);
