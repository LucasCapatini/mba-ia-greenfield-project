import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendConfirmationDto {
  @ApiProperty({
    description: 'E-mail address of the account awaiting confirmation',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
