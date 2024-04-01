import { Card, CardContent, Typography } from "@mui/material";
import React, { ReactNode } from "react";

interface CoveCardProps {
  title: string;
  children?: ReactNode;
}

const CoveCard = ({ title, children }: CoveCardProps) => {
  return (
      <Card sx={{borderRadius: 2, height: '100%', width: '100%'}}>
        <CardContent>
          <Typography gutterBottom variant="h5" component="div" paddingBottom={1}>
            {title}
          </Typography>
          {children}
        </CardContent>
      </Card>
  );
}

export default CoveCard;