import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmEmailDto {
  @ApiProperty({
    description: 'Raw confirmation token received in the e-mail link',
    example: '3f9c2e1d8b7a4c6e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
